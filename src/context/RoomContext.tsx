import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import type {
  Room,
  RoomScrollSyncEvent,
  RoomUserEvent,
  RoomParticipantsUpdatedEvent,
  RoomPermissionChangedEvent,
  RoomEndedEvent,
} from "../types/room";

interface RoomContextType {
  // Connection state
  isConnected: boolean;

  // Room state
  currentRoom: Room | null;
  isInRoom: boolean;

  // Actions
  createRoom: (conversationId: string) => Promise<Room>;
  joinRoom: (code: string) => Promise<Room>;
  leaveRoom: () => Promise<void>;
  endRoom: () => Promise<void>;

  // Permissions (creator only)
  updatePermissions: (userId: string, canControl: boolean) => Promise<void>;

  // Scroll sync
  emitScroll: (messageId: string | null, position: number) => void;
  onScrollSync: (callback: (event: RoomScrollSyncEvent) => void) => void;
  offScrollSync: () => void;
}

const RoomContext = createContext<RoomContextType | null>(null);

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);

  const scrollSyncCallbackRef = useRef<
    ((event: RoomScrollSyncEvent) => void) | null
  >(null);

  // Initialize socket connection when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsConnected(false);
      setCurrentRoom(null);
      return;
    }

    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const socketUrl = import.meta.env.PROD
      ? window.location.origin
      : "http://localhost:3001";

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("Socket connected");
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    // Room events
    newSocket.on("room:user-joined", (event: RoomUserEvent) => {
      setCurrentRoom((prev) => {
        if (!prev) return prev;
        const exists = prev.participants.some((p) => p.id === event.user.id);
        if (exists) {
          return {
            ...prev,
            participants: prev.participants.map((p) =>
              p.id === event.user.id ? { ...p, isOnline: true } : p,
            ),
          };
        }
        return {
          ...prev,
          participants: [
            ...prev.participants,
            {
              id: event.user.id,
              username: event.user.username,
              canControl: false,
              isOnline: true,
            },
          ],
        };
      });
    });

    newSocket.on("room:user-left", (event: RoomUserEvent) => {
      setCurrentRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.filter((p) => p.id !== event.user.id),
        };
      });
    });

    newSocket.on("room:user-offline", (event: RoomUserEvent) => {
      setCurrentRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === event.user.id ? { ...p, isOnline: false } : p,
          ),
        };
      });
    });

    newSocket.on(
      "room:participants-updated",
      (event: RoomParticipantsUpdatedEvent) => {
        setCurrentRoom((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            participants: prev.participants.map((p) =>
              p.id === event.userId
                ? { ...p, canControl: event.canControl }
                : p,
            ),
          };
        });
      },
    );

    newSocket.on(
      "room:permission-changed",
      (event: RoomPermissionChangedEvent) => {
        setCurrentRoom((prev) => {
          if (!prev) return prev;
          return { ...prev, canControl: event.canControl };
        });
      },
    );

    newSocket.on("room:ended", (_event: RoomEndedEvent) => {
      setCurrentRoom(null);
    });

    newSocket.on("room:scroll-sync", (event: RoomScrollSyncEvent) => {
      if (scrollSyncCallbackRef.current) {
        scrollSyncCallbackRef.current(event);
      }
    });

    newSocket.on("room:error", (data: { message: string }) => {
      console.error("Room error:", data.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

  const createRoom = useCallback(
    async (conversationId: string): Promise<Room> => {
      return new Promise((resolve, reject) => {
        if (!socket || !isConnected) {
          reject(new Error("Not connected"));
          return;
        }

        socket.emit(
          "room:create",
          { conversationId },
          (response: { success?: boolean; error?: string; room?: Room }) => {
            if (response.error) {
              reject(new Error(response.error));
            } else if (response.room) {
              setCurrentRoom(response.room);
              resolve(response.room);
            } else {
              reject(new Error("Unknown error"));
            }
          },
        );
      });
    },
    [socket, isConnected],
  );

  const joinRoom = useCallback(
    async (code: string): Promise<Room> => {
      return new Promise((resolve, reject) => {
        if (!socket || !isConnected) {
          reject(new Error("Not connected"));
          return;
        }

        socket.emit(
          "room:join",
          { code },
          (response: { success?: boolean; error?: string; room?: Room }) => {
            if (response.error) {
              reject(new Error(response.error));
            } else if (response.room) {
              setCurrentRoom(response.room);
              resolve(response.room);
            } else {
              reject(new Error("Unknown error"));
            }
          },
        );
      });
    },
    [socket, isConnected],
  );

  const leaveRoom = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socket || !currentRoom) {
        resolve();
        return;
      }

      socket.emit(
        "room:leave",
        { code: currentRoom.code },
        (response: { success?: boolean; error?: string }) => {
          if (response?.error) {
            reject(new Error(response.error));
          } else {
            setCurrentRoom(null);
            resolve();
          }
        },
      );
    });
  }, [socket, currentRoom]);

  const endRoom = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socket || !currentRoom) {
        resolve();
        return;
      }

      socket.emit(
        "room:end",
        { code: currentRoom.code },
        (response: { success?: boolean; error?: string }) => {
          if (response?.error) {
            reject(new Error(response.error));
          } else {
            setCurrentRoom(null);
            resolve();
          }
        },
      );
    });
  }, [socket, currentRoom]);

  const updatePermissions = useCallback(
    async (userId: string, canControl: boolean): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!socket || !currentRoom) {
          reject(new Error("Not in a room"));
          return;
        }

        socket.emit(
          "room:permissions",
          {
            code: currentRoom.code,
            userId,
            canControl,
          },
          (response: { success?: boolean; error?: string }) => {
            if (response?.error) {
              reject(new Error(response.error));
            } else {
              resolve();
            }
          },
        );
      });
    },
    [socket, currentRoom],
  );

  const emitScroll = useCallback(
    (messageId: string | null, position: number) => {
      if (!socket || !currentRoom?.canControl) return;

      socket.emit("room:scroll", {
        code: currentRoom.code,
        messageId,
        position,
      });
    },
    [socket, currentRoom],
  );

  const onScrollSync = useCallback(
    (callback: (event: RoomScrollSyncEvent) => void) => {
      scrollSyncCallbackRef.current = callback;
    },
    [],
  );

  const offScrollSync = useCallback(() => {
    scrollSyncCallbackRef.current = null;
  }, []);

  const value: RoomContextType = {
    isConnected,
    currentRoom,
    isInRoom: !!currentRoom,
    createRoom,
    joinRoom,
    leaveRoom,
    endRoom,
    updatePermissions,
    emitScroll,
    onScrollSync,
    offScrollSync,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return context;
}

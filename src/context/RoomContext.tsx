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
const SOCKET_ACK_TIMEOUT_MS = 10000;
const SOCKET_CONNECT_TIMEOUT_MS = 5000;

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("timeout");
}

async function ensureSocketConnected(socket: Socket): Promise<void> {
  if (socket.connected) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Not connected"));
    }, SOCKET_CONNECT_TIMEOUT_MS);

    const onConnect = () => {
      cleanup();
      resolve();
    };

    const onConnectError = (error: Error) => {
      cleanup();
      reject(new Error(error.message || "Not connected"));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.connect();
  });
}

async function emitWithAck<TResponse>(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    socket
      .timeout(SOCKET_ACK_TIMEOUT_MS)
      .emit(event, payload, (err: Error | null, response?: TResponse) => {
        if (err) {
          reject(new Error("Server timeout. Please try again."));
          return;
        }

        if (typeof response === "undefined") {
          reject(new Error("No response from server"));
          return;
        }

        resolve(response);
      });
  });
}

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
      if (!socket) {
        throw new Error("Not connected");
      }

      await ensureSocketConnected(socket);

      const request = () =>
        emitWithAck<{
          success?: boolean;
          error?: string;
          room?: Room;
        }>(socket, "room:create", { conversationId });

      let response: { success?: boolean; error?: string; room?: Room };
      try {
        response = await request();
      } catch (error) {
        if (!isTimeoutError(error)) {
          throw error;
        }

        await ensureSocketConnected(socket);
        response = await request();
      }

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.room) {
        throw new Error("Unknown error");
      }

      setCurrentRoom(response.room);
      return response.room;
    },
    [socket],
  );

  const joinRoom = useCallback(
    async (code: string): Promise<Room> => {
      if (!socket) {
        throw new Error("Not connected");
      }

      await ensureSocketConnected(socket);

      const response = await emitWithAck<{
        success?: boolean;
        error?: string;
        room?: Room;
      }>(socket, "room:join", { code });

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.room) {
        throw new Error("Unknown error");
      }

      setCurrentRoom(response.room);
      return response.room;
    },
    [socket],
  );

  const leaveRoom = useCallback(async (): Promise<void> => {
    if (!socket || !currentRoom) {
      return;
    }

    const response = await emitWithAck<{ success?: boolean; error?: string }>(
      socket,
      "room:leave",
      { code: currentRoom.code },
    );

    if (response?.error) {
      throw new Error(response.error);
    }

    setCurrentRoom(null);
  }, [socket, currentRoom]);

  const endRoom = useCallback(async (): Promise<void> => {
    if (!socket || !currentRoom) {
      return;
    }

    const response = await emitWithAck<{ success?: boolean; error?: string }>(
      socket,
      "room:end",
      { code: currentRoom.code },
    );

    if (response?.error) {
      throw new Error(response.error);
    }

    setCurrentRoom(null);
  }, [socket, currentRoom]);

  const updatePermissions = useCallback(
    async (userId: string, canControl: boolean): Promise<void> => {
      if (!socket || !currentRoom) {
        throw new Error("Not in a room");
      }

      const response = await emitWithAck<{ success?: boolean; error?: string }>(
        socket,
        "room:permissions",
        {
          code: currentRoom.code,
          userId,
          canControl,
        },
      );

      if (response?.error) {
        throw new Error(response.error);
      }
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

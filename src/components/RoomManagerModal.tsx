import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { useRoom } from "@/context/RoomContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/useMediaQuery";
import {
  AlertCircle,
  Calendar,
  Edit2,
  Loader2,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { AvailableRoom } from "@/types/room";

interface RoomManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoomManagerModal({ isOpen, onClose }: RoomManagerModalProps) {
  const isMobile = useIsMobile();
  const { currentRoom, isConnected, endRoom } = useRoom();
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient<{ rooms: AvailableRoom[] }>(
        "/rooms/available",
      );
      setRooms(response.rooms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rooms");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setEditingCode(null);
      setError(null);
      return;
    }

    void loadRooms();
  }, [isOpen, loadRooms]);

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [rooms],
  );

  const startEdit = (room: AvailableRoom) => {
    setEditingCode(room.code);
    setDraftName(room.name);
    setDraftDescription(room.description || "");
    setError(null);
  };

  const cancelEdit = () => {
    setEditingCode(null);
    setDraftName("");
    setDraftDescription("");
  };

  const handleSave = async (code: string) => {
    setSavingCode(code);
    setError(null);

    try {
      const payload = {
        name: draftName.trim(),
        description: draftDescription.trim(),
      };

      const result = await apiClient<{
        success: boolean;
        room: {
          code: string;
          name: string;
          description: string;
          updatedAt: string;
        };
      }>(`/rooms/${code}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setRooms((prev) =>
        prev.map((room) =>
          room.code === code
            ? {
                ...room,
                name: result.room.name,
                description: result.room.description,
                updatedAt: result.room.updatedAt,
              }
            : room,
        ),
      );

      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update room");
    } finally {
      setSavingCode(null);
    }
  };

  const handleDelete = async (room: AvailableRoom) => {
    const message = `Delete room ${room.code}? This cannot be undone.`;
    if (!confirm(message)) return;

    setDeletingCode(room.code);
    setError(null);

    try {
      if (isConnected && currentRoom?.code === room.code) {
        await endRoom();
      } else {
        await apiClient<{ success: boolean }>(`/rooms/${room.code}`, {
          method: "DELETE",
        });
      }

      setRooms((prev) => prev.filter((r) => r.code !== room.code));
      if (editingCode === room.code) {
        cancelEdit();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete room");
    } finally {
      setDeletingCode(null);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side={isMobile ? "bottom" : "center"}
        className={
          isMobile
            ? "sm:max-w-3xl sm:mx-auto sm:rounded-t-xl max-h-[90vh]"
            : "max-w-3xl"
        }
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Room Manager
          </SheetTitle>
          <SheetDescription>
            Browse available rooms. Admins and room owners can edit or delete.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3 overflow-y-auto max-h-[62vh] pr-1">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading rooms...
            </div>
          ) : sortedRooms.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No active rooms available.
            </div>
          ) : (
            sortedRooms.map((room) => {
              const isEditing = editingCode === room.code;
              const isSaving = savingCode === room.code;
              const isDeleting = deletingCode === room.code;

              return (
                <div
                  key={room.code}
                  className="rounded-lg border bg-card p-3 space-y-3"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        maxLength={80}
                        placeholder="Room name"
                      />
                      <Input
                        value={draftDescription}
                        onChange={(e) => setDraftDescription(e.target.value)}
                        maxLength={240}
                        placeholder="Description (optional)"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{room.name}</span>
                        <span className="font-mono rounded bg-muted px-2 py-0.5 text-xs">
                          {room.code}
                        </span>
                        {room.isOwner && (
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            Owner
                          </span>
                        )}
                      </div>
                      {room.description && (
                        <p className="text-sm text-muted-foreground">
                          {room.description}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>Conversation: {room.conversationTitle}</p>
                    <p>Owner: {room.creatorUsername}</p>
                    <p>
                      Participants: {room.onlineCount}/{room.participantCount}{" "}
                      online
                    </p>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Updated {new Date(room.updatedAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {room.canManage &&
                      (isEditing ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            disabled={isSaving}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSave(room.code)}
                            disabled={isSaving || !draftName.trim()}
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-1" />
                            )}
                            Save
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(room)}
                            disabled={isDeleting}
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(room)}
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-1" />
                            )}
                            Delete
                          </Button>
                        </>
                      ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <SheetFooter className="mt-4 flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={loadRooms}>
            Refresh
          </Button>
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

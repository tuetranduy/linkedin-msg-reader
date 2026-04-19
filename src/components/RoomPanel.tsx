import { useState } from "react";
import { useRoom } from "@/context/RoomContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  X,
  Copy,
  Check,
  LogOut,
  Wifi,
  WifiOff,
  Crown,
  MousePointer,
  MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RoomPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoomPanel({ isOpen, onClose }: RoomPanelProps) {
  const { currentRoom, isConnected, leaveRoom, endRoom, updatePermissions } =
    useRoom();
  const [copied, setCopied] = useState(false);
  const [updatingPermission, setUpdatingPermission] = useState<string | null>(
    null,
  );

  const copyRoomCode = async () => {
    if (!currentRoom) return;

    try {
      await navigator.clipboard.writeText(currentRoom.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleTogglePermission = async (
    userId: string,
    currentCanControl: boolean,
  ) => {
    if (!currentRoom?.isCreator) return;

    setUpdatingPermission(userId);
    try {
      await updatePermissions(userId, !currentCanControl);
    } catch (err) {
      console.error("Failed to update permission:", err);
    } finally {
      setUpdatingPermission(null);
    }
  };

  const handleLeaveRoom = async () => {
    try {
      await leaveRoom();
      onClose();
    } catch (err) {
      console.error("Failed to leave room:", err);
    }
  };

  const handleEndRoom = async () => {
    if (!confirm("Are you sure you want to end this room for everyone?"))
      return;

    try {
      await endRoom();
      onClose();
    } catch (err) {
      console.error("Failed to end room:", err);
    }
  };

  if (!isOpen || !currentRoom) return null;

  const onlineCount = currentRoom.participants.filter((p) => p.isOnline).length;

  return (
    <div className="flex h-full w-full lg:w-80 flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-3 lg:p-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Read Together</h3>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {onlineCount} online
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 lg:p-4 space-y-4">
          {/* Connection status */}
          <div className="flex items-center gap-2 text-sm">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-600 dark:text-green-400">
                  Connected
                </span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-red-600 dark:text-red-400">
                  Disconnected
                </span>
              </>
            )}
          </div>

          {/* Room code */}
          <div className="rounded-lg border border-border p-3 bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Room Code</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyRoomCode}
                className="h-7 px-2 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="font-mono text-2xl font-bold tracking-widest text-center">
              {currentRoom.code}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Share this code with others to invite them
            </p>
          </div>

          {/* Your control status */}
          <div
            className={cn(
              "rounded-lg border p-3",
              currentRoom.canControl
                ? "border-green-500/30 bg-green-500/10"
                : "border-muted bg-muted/30",
            )}
          >
            <div className="flex items-center gap-2">
              {currentRoom.canControl ? (
                <>
                  <MousePointerClick className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    You can control scroll
                  </span>
                </>
              ) : (
                <>
                  <MousePointer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Follow mode - scroll synced
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Participants */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              Participants ({currentRoom.participants.length})
            </h4>
            <div className="space-y-2">
              {currentRoom.participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        participant.isOnline ? "bg-green-500" : "bg-gray-400",
                      )}
                    />
                    <span className="text-sm font-medium">
                      {participant.username}
                    </span>
                    {currentRoom.isCreator &&
                      participant.id ===
                        currentRoom.participants.find(
                          (p) =>
                            p.id === participant.id && currentRoom.isCreator,
                        )?.id &&
                      participant.canControl &&
                      currentRoom.participants[0]?.id === participant.id && (
                        <Crown className="h-3 w-3 text-yellow-500" />
                      )}
                  </div>

                  <div className="flex items-center gap-1">
                    {participant.canControl && (
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <MousePointerClick className="h-3 w-3" />
                      </span>
                    )}

                    {/* Toggle permission button (creator only, not for self) */}
                    {currentRoom.isCreator &&
                      !currentRoom.participants.find(
                        (p) =>
                          p.id === participant.id &&
                          currentRoom.isCreator &&
                          p === currentRoom.participants[0],
                      ) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleTogglePermission(
                              participant.id,
                              participant.canControl,
                            )
                          }
                          disabled={updatingPermission === participant.id}
                          className="h-6 px-2 text-xs"
                          title={
                            participant.canControl
                              ? "Revoke control"
                              : "Grant control"
                          }
                        >
                          {participant.canControl ? (
                            <MousePointerClick className="h-3 w-3 text-green-600" />
                          ) : (
                            <MousePointer className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer actions */}
      <div className="border-t border-border p-3 lg:p-4 space-y-2">
        {currentRoom.isCreator ? (
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleEndRoom}
          >
            <X className="h-4 w-4 mr-2" />
            End Room
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLeaveRoom}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Leave Room
          </Button>
        )}
      </div>
    </div>
  );
}

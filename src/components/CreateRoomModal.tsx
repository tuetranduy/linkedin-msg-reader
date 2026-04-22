import { useState } from "react";
import { useRoom } from "@/context/RoomContext";
import { useMessages } from "@/context/MessageContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Users, Loader2, AlertCircle, Copy, Check } from "lucide-react";

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateRoomModal({
  isOpen,
  onClose,
  onCreated,
}: CreateRoomModalProps) {
  const { createRoom } = useRoom();
  const { selectedConversation } = useMessages();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!selectedConversation) {
      setError("No conversation selected");
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const room = await createRoom(selectedConversation.id);
      setCreatedCode(room.code);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  const copyCode = async () => {
    if (!createdCode) return;

    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleClose = () => {
    setIsCreating(false);
    setCreatedCode(null);
    setError(null);
    setCopied(false);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="center" className="max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {createdCode ? "Room Created!" : "Create Reading Room"}
          </SheetTitle>
          <SheetDescription>
            {createdCode
              ? "Share this code with others to read together"
              : "Create a room to read this conversation together with others"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {createdCode ? (
            <>
              {/* Success state - show room code */}
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    Room Code
                  </p>
                  <div className="font-mono text-4xl font-bold tracking-widest text-primary">
                    {createdCode}
                  </div>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={copyCode}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Code
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                When others scroll, you'll follow along automatically.
                <br />
                As the room creator, you control who can scroll.
              </p>
            </>
          ) : (
            <>
              {/* Create state */}
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <h4 className="font-medium text-sm mb-1">
                  {selectedConversation?.title || "No conversation selected"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {selectedConversation?.messages.length || 0} messages
                </p>
              </div>

              <div className="text-sm text-muted-foreground space-y-2">
                <p>• You'll be the room creator with scroll control</p>
                <p>• Others join with your room code</p>
                <p>• You can grant scroll control to others</p>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <SheetFooter className="mt-6 flex-col sm:flex-row gap-2">
          {createdCode ? (
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isCreating}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!selectedConversation || isCreating}
                className="w-full sm:w-auto"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Create Room
                  </>
                )}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

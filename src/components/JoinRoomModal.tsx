import { useState } from "react";
import { useRoom } from "@/context/RoomContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Users, Loader2, AlertCircle } from "lucide-react";

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoined?: () => void;
}

export function JoinRoomModal({
  isOpen,
  onClose,
  onJoined,
}: JoinRoomModalProps) {
  const isMobile = useIsMobile();
  const { joinRoom } = useRoom();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      setError("Please enter a room code");
      return;
    }

    setError(null);
    setIsJoining(true);

    try {
      await joinRoom(code.trim().toUpperCase());
      setCode("");
      onJoined?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow alphanumeric, convert to uppercase
    const value = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    setCode(value.slice(0, 6)); // Max 6 characters
    setError(null);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side={isMobile ? "bottom" : "center"}
        className={
          isMobile ? "sm:max-w-md sm:mx-auto sm:rounded-t-xl" : "max-w-md"
        }
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Join Room
          </SheetTitle>
          <SheetDescription>
            Enter the 6-character room code to join a reading session
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Input
              value={code}
              onChange={handleCodeChange}
              placeholder="Enter room code"
              className="text-center font-mono text-2xl tracking-widest h-14"
              maxLength={6}
              autoFocus
              disabled={isJoining}
            />
            {code.length > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                {code.length}/6 characters
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <SheetFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isJoining}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={code.length !== 6 || isJoining}
              className="w-full sm:w-auto"
            >
              {isJoining ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Room"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

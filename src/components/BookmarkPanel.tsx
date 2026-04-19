import React from "react";
import { useMessages } from "@/context/MessageContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bookmark, X, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface BookmarkPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BookmarkPanel({ isOpen, onClose }: BookmarkPanelProps) {
  const { bookmarks, removeBookmark, goToBookmark, conversations } =
    useMessages();

  const getConversationTitle = (conversationId: string) => {
    const conversation = conversations.find((c) => c.id === conversationId);
    return conversation?.title || "Unknown conversation";
  };

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-80 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Bookmarks</h3>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {bookmarks.length}
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
        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Bookmark className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No bookmarks yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Click the bookmark icon on any message to save it here
            </p>
          </div>
        ) : (
          <div className="p-2">
            {bookmarks.map((bookmark) => (
              <div
                key={bookmark.messageId}
                className={cn(
                  "group relative mb-2 rounded-lg border border-border p-3 transition-colors hover:bg-accent",
                )}
              >
                <button
                  onClick={() => goToBookmark(bookmark)}
                  className="w-full text-left"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">{bookmark.from}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(bookmark.date)}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {bookmark.content}
                  </p>

                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate">
                      {getConversationTitle(bookmark.conversationId)}
                    </span>
                  </div>
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBookmark(bookmark.messageId);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

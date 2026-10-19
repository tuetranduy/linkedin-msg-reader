import { useEffect } from "react";
import { useMessages } from "@/context/MessageContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bookmark, X, ExternalLink, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface BookmarkPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BookmarkPanel({ isOpen, onClose }: BookmarkPanelProps) {
  const {
    bookmarks,
    removeBookmark,
    goToBookmark,
    conversations,
    refreshBookmarks,
  } = useMessages();

  // Refresh bookmarks when panel opens
  useEffect(() => {
    if (isOpen) {
      refreshBookmarks();
    }
  }, [isOpen, refreshBookmarks]);

  const getConversationTitle = (conversationId: string) => {
    const conversation = conversations.find((c) => c.id === conversationId);
    return conversation?.title || "Unknown conversation";
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Bookmarks"
      className="flex h-full w-full flex-col border-l border-border bg-card md:w-80 md:shrink-0"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bookmark aria-hidden="true" className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Bookmarks</h3>
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium tabular-nums text-accent-foreground">
            {bookmarks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close bookmarks"
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
              <Bookmark aria-hidden="true" className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">No bookmarks yet</p>
            <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">
              Hover a message and tap the bookmark icon to save it here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2 p-3">
            {bookmarks.map((bookmark) => (
              <li
                key={bookmark.messageId}
                className="group relative rounded-lg border border-border bg-card transition-colors hover:border-primary/30 hover:bg-accent/50"
              >
                <button
                  onClick={() => {
                    goToBookmark(bookmark);
                    onClose();
                  }}
                  className="w-full rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="mb-1 flex items-baseline justify-between gap-2 pr-7">
                    <span className="truncate text-sm font-medium">
                      {bookmark.from}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(bookmark.date)}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {bookmark.content}
                  </p>

                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {getConversationTitle(bookmark.conversationId)}
                    </span>
                  </div>
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove bookmark from ${bookmark.from}`}
                  title="Remove bookmark"
                  className="absolute right-1.5 top-1.5 h-7 w-7 text-muted-foreground transition-opacity hover:text-destructive [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBookmark(bookmark.messageId);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}

import { useMemo, useState } from "react";
import { useMessages } from "@/context/MessageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDate, getAvatarColor, getInitials } from "@/lib/utils";
import { Search, SearchX, X } from "lucide-react";

interface ConversationListProps {
  onSelectConversation?: (id: string) => void;
}

export function ConversationList({
  onSelectConversation,
}: ConversationListProps) {
  const { conversations, selectedConversation, selectConversation } =
    useMessages();
  const [filter, setFilter] = useState("");

  const filteredConversations = useMemo(() => {
    if (!filter.trim()) return conversations;
    const query = filter.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.lastMessage?.content.toLowerCase().includes(query),
    );
  }, [conversations, filter]);

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    onSelectConversation?.(id);
  };

  return (
    <nav
      aria-label="Conversations"
      className="flex h-full flex-col border-r border-border bg-card"
    >
      <div className="space-y-3 border-b border-border p-3 lg:p-4">
        <div className="flex items-baseline justify-between gap-2 pr-8 md:pr-0">
          <h2 className="text-base font-semibold tracking-tight">Messages</h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {filter.trim()
              ? `${filteredConversations.length} of ${conversations.length}`
              : conversations.length}
          </span>
        </div>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Filter conversations"
            placeholder="Filter conversations"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setFilter("");
            }}
            className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {filter && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear filter"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => setFilter("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <ul className="space-y-0.5 p-2">
          {filteredConversations.length === 0 ? (
            <li className="flex flex-col items-center px-4 py-10 text-center">
              <SearchX
                aria-hidden="true"
                className="mb-3 h-8 w-8 text-muted-foreground/50"
              />
              <p className="text-sm font-medium">No matches</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No conversation matches “{filter}”.
              </p>
              <Button
                variant="link"
                size="sm"
                className="mt-1"
                onClick={() => setFilter("")}
              >
                Clear filter
              </Button>
            </li>
          ) : (
            filteredConversations.map((conversation) => {
              const isSelected = selectedConversation?.id === conversation.id;
              const count =
                conversation.messageCount ?? conversation.messages.length;
              return (
                <li key={conversation.id}>
                  <button
                    onClick={() => handleSelectConversation(conversation.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected &&
                        "bg-accent hover:bg-accent before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary",
                    )}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback
                        className={cn(
                          "text-sm font-semibold",
                          getAvatarColor(conversation.title),
                        )}
                      >
                        {getInitials(conversation.title)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            isSelected && "text-accent-foreground",
                          )}
                        >
                          {conversation.title}
                        </span>
                        {conversation.lastMessage && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDate(conversation.lastMessage.date)}
                          </span>
                        )}
                      </div>

                      {conversation.lastMessage ? (
                        <p className="truncate text-sm text-muted-foreground">
                          {conversation.lastMessage.isCurrentUser ? "You: " : ""}
                          {conversation.lastMessage.content}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {count.toLocaleString()}{" "}
                          {count === 1 ? "message" : "messages"}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>
    </nav>
  );
}

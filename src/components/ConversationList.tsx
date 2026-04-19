import React, { useMemo, useState } from "react";
import { useMessages } from "@/context/MessageContext";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDate } from "@/lib/utils";
import { Search } from "lucide-react";

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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    onSelectConversation?.(id);
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="border-b border-border p-3 lg:p-4">
        <h2 className="mb-2 lg:mb-3 text-base lg:text-lg font-semibold">
          Messages
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter conversations..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1.5 lg:p-2">
          {filteredConversations.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No conversations found
            </p>
          ) : (
            filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation.id)}
                className={cn(
                  "flex w-full items-start gap-2 lg:gap-3 rounded-lg p-2 lg:p-3 text-left transition-colors hover:bg-accent active:bg-accent/80",
                  selectedConversation?.id === conversation.id && "bg-accent",
                )}
              >
                <Avatar className="h-9 w-9 lg:h-10 lg:w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs lg:text-sm">
                    {getInitials(conversation.title)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 overflow-hidden min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-sm lg:text-base">
                      {conversation.title}
                    </span>
                    {conversation.lastMessage && (
                      <span className="shrink-0 text-[10px] lg:text-xs text-muted-foreground">
                        {formatDate(conversation.lastMessage.date)}
                      </span>
                    )}
                  </div>

                  {conversation.lastMessage && (
                    <p className="truncate text-xs lg:text-sm text-muted-foreground">
                      {conversation.lastMessage.isCurrentUser ? "You: " : ""}
                      {conversation.lastMessage.content.slice(0, 50)}
                    </p>
                  )}

                  <p className="mt-0.5 lg:mt-1 text-[10px] lg:text-xs text-muted-foreground">
                    {conversation.messages.length} messages
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

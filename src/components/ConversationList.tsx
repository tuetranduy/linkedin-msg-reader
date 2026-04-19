import React, { useMemo, useState } from "react";
import { useMessages } from "@/context/MessageContext";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDate } from "@/lib/utils";
import { Search } from "lucide-react";

export function ConversationList() {
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

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="mb-3 text-lg font-semibold">Messages</h2>
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
        <div className="p-2">
          {filteredConversations.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No conversations found
            </p>
          ) : (
            filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => selectConversation(conversation.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent",
                  selectedConversation?.id === conversation.id && "bg-accent",
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(conversation.title)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {conversation.title}
                    </span>
                    {conversation.lastMessage && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(conversation.lastMessage.date)}
                      </span>
                    )}
                  </div>

                  {conversation.lastMessage && (
                    <p className="truncate text-sm text-muted-foreground">
                      {conversation.lastMessage.isCurrentUser ? "You: " : ""}
                      {conversation.lastMessage.content.slice(0, 50)}
                    </p>
                  )}

                  <p className="mt-1 text-xs text-muted-foreground">
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

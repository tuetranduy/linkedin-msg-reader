import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Users, Search, MessageSquare } from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  participants: string[];
  message_count: number;
  last_message_date: string;
  isVisible: boolean;
}

export function ConversationManager() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiClient<{ conversations: Conversation[] }>(
        "/conversations",
      );
      setConversations(data.conversations);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const toggleVisibility = async (id: string, currentVisibility: boolean) => {
    try {
      await apiClient(`/conversations/${id}/visibility`, {
        method: "PUT",
        body: JSON.stringify({ isVisible: !currentVisibility }),
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, isVisible: !currentVisibility } : c,
        ),
      );
    } catch (err) {
      console.error("Failed to update visibility:", err);
    }
  };

  const setAllVisibility = async (isVisible: boolean) => {
    try {
      await Promise.all(
        conversations.map((c) =>
          apiClient(`/conversations/${c.id}/visibility`, {
            method: "PUT",
            body: JSON.stringify({ isVisible }),
          }),
        ),
      );
      setConversations((prev) => prev.map((c) => ({ ...c, isVisible })));
    } catch (err) {
      console.error("Failed to update visibility:", err);
    }
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.title.toLowerCase().includes(filter.toLowerCase()) ||
      c.participants.some((p) =>
        p.toLowerCase().includes(filter.toLowerCase()),
      ),
  );

  if (isLoading) {
    return <div className="p-4">Loading conversations...</div>;
  }

  if (conversations.length === 0) {
    return (
      <div className="p-6 lg:p-8 text-center text-muted-foreground">
        <Users className="h-10 w-10 lg:h-12 lg:w-12 mx-auto mb-3 lg:mb-4 opacity-50" />
        <p>No conversations yet. Upload a CSV file first.</p>
      </div>
    );
  }

  const visibleCount = conversations.filter((c) => c.isVisible).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg lg:text-xl font-semibold">
            Conversation Visibility
          </h2>
          <p className="text-xs lg:text-sm text-muted-foreground">
            {visibleCount} of {conversations.length} visible to users
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAllVisibility(true)}
            className="flex-1 sm:flex-none"
          >
            <Eye className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Show All</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAllVisibility(false)}
            className="flex-1 sm:flex-none"
          >
            <EyeOff className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Hide All</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter conversations..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Desktop: Table view */}
      <div className="hidden md:block border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
        <table className="w-full">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left">Conversation</th>
              <th className="px-4 py-2 text-center">Messages</th>
              <th className="px-4 py-2 text-center">Last Activity</th>
              <th className="px-4 py-2 text-center">Visible</th>
            </tr>
          </thead>
          <tbody>
            {filteredConversations.map((conv) => (
              <tr key={conv.id} className="border-t hover:bg-muted/50">
                <td className="px-4 py-2">
                  <div className="font-medium truncate max-w-[300px]">
                    {conv.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                    {conv.participants.join(", ")}
                  </div>
                </td>
                <td className="px-4 py-2 text-center text-sm">
                  {conv.message_count}
                </td>
                <td className="px-4 py-2 text-center text-sm text-muted-foreground">
                  {new Date(conv.last_message_date).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-center">
                  <Button
                    variant={conv.isVisible ? "default" : "ghost"}
                    size="sm"
                    onClick={() => toggleVisibility(conv.id, conv.isVisible)}
                  >
                    {conv.isVisible ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Card view */}
      <div className="md:hidden space-y-3 max-h-[60vh] overflow-y-auto">
        {filteredConversations.map((conv) => (
          <div key={conv.id} className="border rounded-lg p-3 bg-card">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{conv.title}</div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {conv.participants.join(", ")}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {conv.message_count}
                  </span>
                  <span>
                    {new Date(conv.last_message_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <Button
                variant={conv.isVisible ? "default" : "ghost"}
                size="sm"
                onClick={() => toggleVisibility(conv.id, conv.isVisible)}
                className="flex-shrink-0"
              >
                {conv.isVisible ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

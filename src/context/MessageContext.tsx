import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { Conversation, Message, Bookmark } from "../types/message";
import { apiClient } from "../api/client";

interface MessageContextType {
  // Data
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  selectConversation: (id: string) => void;
  refreshConversations: () => Promise<void>;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  currentSearchIndex: number;
  goToNextResult: () => void;
  goToPrevResult: () => void;
  highlightedMessageId: string | null;
  setHighlightedMessageId: (id: string | null) => void;

  // Bookmarks
  bookmarks: Bookmark[];
  addBookmark: (message: Message) => void;
  removeBookmark: (messageId: string) => void;
  isBookmarked: (messageId: string) => boolean;
  goToBookmark: (bookmark: Bookmark) => void;
}

interface SearchResult {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  messageIndex: number;
  message: Message;
}

const MessageContext = createContext<MessageContextType | null>(null);

interface ApiConversation {
  id: string;
  title: string;
  participants: string[];
  message_count: number;
  last_message_date: string;
  isVisible: boolean;
}

interface ApiMessage {
  id: string;
  conversation_id: string;
  from_name: string;
  to_name: string;
  date: string;
  content: string;
  folder: string;
}

interface ApiBookmark {
  id: number;
  message_id: string;
  conversation_id: string;
  content: string;
  from_name: string;
  message_date: string;
  created_at: string;
}

export function MessageProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // Load conversations on mount
  const refreshConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient<{ conversations: ApiConversation[] }>(
        "/conversations",
      );
      const convos: Conversation[] = data.conversations.map((c) => ({
        id: c.id,
        title: c.title,
        participants: c.participants,
        messages: [],
        lastMessageDate: new Date(c.last_message_date),
      }));
      setConversations(convos);
      if (convos.length > 0 && !selectedConversationId) {
        setSelectedConversationId(convos[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    refreshConversations();
  }, []);

  // Load bookmarks on mount
  useEffect(() => {
    apiClient<{ bookmarks: ApiBookmark[] }>("/bookmarks")
      .then((data) => {
        setBookmarks(
          data.bookmarks.map((b) => ({
            messageId: b.message_id,
            conversationId: b.conversation_id,
            content: b.content,
            from: b.from_name,
            date: new Date(b.message_date),
            createdAt: new Date(b.created_at),
          })),
        );
      })
      .catch(console.error);
  }, []);

  // Load full conversation when selected
  useEffect(() => {
    if (!selectedConversationId) {
      setSelectedConversation(null);
      return;
    }

    apiClient<{ conversation: ApiConversation; messages: ApiMessage[] }>(
      `/conversations/${selectedConversationId}`,
    )
      .then((data) => {
        const messages: Message[] = data.messages.map((m) => ({
          id: m.id,
          conversationId: m.conversation_id,
          from: m.from_name,
          to: m.to_name,
          date: new Date(m.date),
          content: m.content,
          folder: m.folder,
          attachments: [],
        }));
        setSelectedConversation({
          id: data.conversation.id,
          title: data.conversation.title,
          participants: data.conversation.participants,
          messages,
          lastMessageDate: new Date(data.conversation.last_message_date),
        });
      })
      .catch(console.error);
  }, [selectedConversationId]);

  const selectConversation = useCallback((id: string) => {
    setSelectedConversationId(id);
    setHighlightedMessageId(null);
  }, []);

  // Search functionality - uses API for cross-conversation search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const data = await apiClient<{
          results: Array<{
            conversation_id: string;
            conversation_title: string;
            message_id: string;
            from_name: string;
            content: string;
            date: string;
          }>;
        }>(`/search?q=${encodeURIComponent(searchQuery)}`);

        const results: SearchResult[] = data.results.map((r, index) => ({
          conversationId: r.conversation_id,
          conversationTitle: r.conversation_title,
          messageId: r.message_id,
          messageIndex: index,
          message: {
            id: r.message_id,
            conversationId: r.conversation_id,
            from: r.from_name,
            to: "",
            date: new Date(r.date),
            content: r.content,
            folder: "",
            attachments: [],
          },
        }));

        setSearchResults(results);
        setCurrentSearchIndex(0);

        // Auto-navigate to first result
        if (results.length > 0) {
          setSelectedConversationId(results[0].conversationId);
          setHighlightedMessageId(results[0].messageId);
        }
      } catch (e) {
        console.error("Search failed:", e);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const goToNextResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    const result = searchResults[nextIndex];
    setSelectedConversationId(result.conversationId);
    setHighlightedMessageId(result.messageId);
  }, [searchResults, currentSearchIndex]);

  const goToPrevResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const prevIndex =
      (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    const result = searchResults[prevIndex];
    setSelectedConversationId(result.conversationId);
    setHighlightedMessageId(result.messageId);
  }, [searchResults, currentSearchIndex]);

  // Bookmark functionality - server-persisted
  const addBookmark = useCallback(async (message: Message) => {
    try {
      await apiClient("/bookmarks", {
        method: "POST",
        body: JSON.stringify({ messageId: message.id }),
      });
      const bookmark: Bookmark = {
        messageId: message.id,
        conversationId: message.conversationId,
        content: message.content.slice(0, 100),
        from: message.from,
        date: message.date,
        createdAt: new Date(),
      };
      setBookmarks((prev) => [bookmark, ...prev]);
    } catch (e) {
      console.error("Failed to add bookmark:", e);
    }
  }, []);

  const removeBookmark = useCallback(async (messageId: string) => {
    try {
      await apiClient(`/bookmarks/${messageId}`, { method: "DELETE" });
      setBookmarks((prev) => prev.filter((b) => b.messageId !== messageId));
    } catch (e) {
      console.error("Failed to remove bookmark:", e);
    }
  }, []);

  const isBookmarked = useCallback(
    (messageId: string) => {
      return bookmarks.some((b) => b.messageId === messageId);
    },
    [bookmarks],
  );

  const goToBookmark = useCallback((bookmark: Bookmark) => {
    setSelectedConversationId(bookmark.conversationId);
    setHighlightedMessageId(bookmark.messageId);
  }, []);

  return (
    <MessageContext.Provider
      value={{
        conversations,
        selectedConversation,
        isLoading,
        error,
        selectConversation,
        refreshConversations,
        searchQuery,
        setSearchQuery,
        searchResults,
        currentSearchIndex,
        goToNextResult,
        goToPrevResult,
        highlightedMessageId,
        setHighlightedMessageId,
        bookmarks,
        addBookmark,
        removeBookmark,
        isBookmarked,
        goToBookmark,
      }}
    >
      {children}
    </MessageContext.Provider>
  );
}

export function useMessages() {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("useMessages must be used within a MessageProvider");
  }
  return context;
}

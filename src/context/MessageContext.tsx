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
  isLoadingConversation: boolean;
  error: string | null;

  // Actions
  selectConversation: (id: string) => void;
  refreshConversations: () => Promise<void>;

  // Lazy loading
  loadMoreMessages: () => Promise<void>;
  loadAllMessages: () => Promise<void>;
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  loadingProgress: number;
  totalMessageCount: number;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  currentSearchIndex: number;
  goToNextResult: () => void;
  goToPrevResult: () => void;
  goToSearchResult: (result: SearchResult) => void;
  highlightedMessageId: string | null;
  setHighlightedMessageId: (id: string | null) => void;
  isSearching: boolean;
  isNavigatingToMessage: boolean;
  navigationProgress: number;

  // Bookmarks
  bookmarks: Bookmark[];
  addBookmark: (message: Message) => void;
  removeBookmark: (messageId: string) => void;
  isBookmarked: (messageId: string) => boolean;
  goToBookmark: (bookmark: Bookmark) => void;
  goToDate: (date: Date) => Promise<boolean>;
  refreshBookmarks: () => Promise<void>;
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
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy loading state
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [totalMessageCount, setTotalMessageCount] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isNavigatingToMessage, setIsNavigatingToMessage] = useState(false);
  const [navigationProgress, setNavigationProgress] = useState(0);
  const [pendingMessageNavigation, setPendingMessageNavigation] = useState<{
    conversationId: string;
    messageId: string;
    messageDate: Date;
  } | null>(null);

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
        messageCount: c.message_count,
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
  const refreshBookmarks = useCallback(async () => {
    try {
      const data = await apiClient<{ bookmarks: ApiBookmark[] }>("/bookmarks");
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
    } catch (e) {
      console.error("Failed to load bookmarks:", e);
    }
  }, []);

  useEffect(() => {
    refreshBookmarks();
  }, [refreshBookmarks]);

  // Load full conversation when selected
  useEffect(() => {
    if (!selectedConversationId) {
      setSelectedConversation(null);
      setHasMoreMessages(false);
      setTotalMessageCount(0);
      return;
    }

    setIsLoadingConversation(true);
    apiClient<{
      conversation: ApiConversation;
      messages: ApiMessage[];
      hasMore: boolean;
      totalCount: number;
    }>(`/conversations/${selectedConversationId}?limit=200`)
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
        setHasMoreMessages(data.hasMore);
        setTotalMessageCount(data.totalCount);
      })
      .catch(console.error)
      .finally(() => setIsLoadingConversation(false));
  }, [selectedConversationId]);

  // Handle pending message navigation - load messages until we find the target
  useEffect(() => {
    if (!pendingMessageNavigation || !selectedConversation) return;
    if (selectedConversation.id !== pendingMessageNavigation.conversationId)
      return;
    if (isLoadingConversation) return;

    const targetMessageId = pendingMessageNavigation.messageId;
    // Check if message is already loaded
    const messageExists = selectedConversation.messages.some(
      (m) => m.id === targetMessageId,
    );

    if (messageExists) {
      // Message found, highlight it
      setNavigationProgress(100);
      setHighlightedMessageId(targetMessageId);
      setPendingMessageNavigation(null);
      setIsNavigatingToMessage(false);
      return;
    }

    // Message not found, need to load more messages
    // Load messages around the target date
    const loadMessagesUntilFound = async () => {
      setIsNavigatingToMessage(true);
      setNavigationProgress(0);
      let found = false;
      let currentMessages = [...selectedConversation.messages];
      let hasMore = true;
      const total = Math.max(totalMessageCount, currentMessages.length, 1);

      while (!found && hasMore) {
        const oldestMessage = currentMessages[0];
        if (!oldestMessage) break;

        try {
          const data = await apiClient<{
            messages: ApiMessage[];
            hasMore: boolean;
          }>(
            `/conversations/${selectedConversation.id}?limit=2000&before=${oldestMessage.date.toISOString()}`,
          );

          const olderMessages: Message[] = data.messages.map((m) => ({
            id: m.id,
            conversationId: m.conversation_id,
            from: m.from_name,
            to: m.to_name,
            date: new Date(m.date),
            content: m.content,
            folder: m.folder,
            attachments: [],
          }));

          if (olderMessages.length === 0) {
            hasMore = false;
            break;
          }

          currentMessages = [...olderMessages, ...currentMessages];
          hasMore = data.hasMore;

          // Check if target message is now in our loaded messages
          found = olderMessages.some((m) => m.id === targetMessageId);

          const progress = Math.min(
            Math.round((currentMessages.length / total) * 100),
            found || !hasMore ? 100 : 99,
          );
          setNavigationProgress(progress);
        } catch (e) {
          console.error("Failed to load messages:", e);
          break;
        }
      }

      if (currentMessages.length > selectedConversation.messages.length) {
        setSelectedConversation((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: currentMessages,
          };
        });
      }
      setHasMoreMessages(hasMore);

      if (found) {
        setNavigationProgress(100);
        setHighlightedMessageId(targetMessageId);
      }
      setPendingMessageNavigation(null);
      setIsNavigatingToMessage(false);
    };

    loadMessagesUntilFound();
  }, [
    pendingMessageNavigation,
    selectedConversation,
    isLoadingConversation,
    hasMoreMessages,
    totalMessageCount,
  ]);

  // Load more messages (older messages)
  const loadMoreMessages = useCallback(async () => {
    if (!selectedConversation || !hasMoreMessages || isLoadingMore) return;

    const oldestMessage = selectedConversation.messages[0];
    if (!oldestMessage) return;

    setIsLoadingMore(true);
    try {
      const data = await apiClient<{
        messages: ApiMessage[];
        hasMore: boolean;
      }>(
        `/conversations/${selectedConversation.id}?limit=200&before=${oldestMessage.date.toISOString()}`,
      );

      const olderMessages: Message[] = data.messages.map((m) => ({
        id: m.id,
        conversationId: m.conversation_id,
        from: m.from_name,
        to: m.to_name,
        date: new Date(m.date),
        content: m.content,
        folder: m.folder,
        attachments: [],
      }));

      setSelectedConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...olderMessages, ...prev.messages],
        };
      });
      setHasMoreMessages(data.hasMore);
    } catch (e) {
      console.error("Failed to load more messages:", e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedConversation, hasMoreMessages, isLoadingMore]);

  // Load all messages from beginning
  const loadAllMessages = useCallback(async () => {
    if (!selectedConversation || isLoadingMore) return;

    setIsLoadingMore(true);
    setLoadingProgress(0);
    try {
      // Load all messages - keep loading until we have everything
      let allMessages: Message[] = [];
      let hasMore = true;
      let beforeDate: string | null = null;
      const total = totalMessageCount || 1;

      while (hasMore) {
        const url = beforeDate
          ? `/conversations/${selectedConversation.id}?limit=1000&before=${beforeDate}`
          : `/conversations/${selectedConversation.id}?limit=1000`;

        const data = await apiClient<{
          messages: ApiMessage[];
          hasMore: boolean;
        }>(url);

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

        if (messages.length === 0) break;

        // Prepend older messages
        allMessages = [...messages, ...allMessages];
        hasMore = data.hasMore;

        // Update progress
        const progress = Math.min(
          Math.round((allMessages.length / total) * 100),
          99,
        );
        setLoadingProgress(progress);

        if (hasMore && messages.length > 0) {
          // Get the oldest message date for next batch
          beforeDate = messages[0].date.toISOString();
        }
      }

      setSelectedConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: allMessages,
        };
      });
      setHasMoreMessages(false);
      setLoadingProgress(100);
    } catch (e) {
      console.error("Failed to load all messages:", e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedConversation, isLoadingMore, totalMessageCount]);

  const selectConversation = useCallback((id: string) => {
    setSelectedConversationId(id);
    setHighlightedMessageId(null);
  }, []);

  // Search functionality - uses API for cross-conversation search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

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
    setIsSearching(true);
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
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setIsSearching(false);
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
    setIsNavigatingToMessage(true);
    setPendingMessageNavigation({
      conversationId: result.conversationId,
      messageId: result.messageId,
      messageDate: result.message.date,
    });
    setSelectedConversationId(result.conversationId);
  }, [searchResults, currentSearchIndex]);

  const goToPrevResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const prevIndex =
      (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    const result = searchResults[prevIndex];
    setIsNavigatingToMessage(true);
    setPendingMessageNavigation({
      conversationId: result.conversationId,
      messageId: result.messageId,
      messageDate: result.message.date,
    });
    setSelectedConversationId(result.conversationId);
  }, [searchResults, currentSearchIndex]);

  const goToSearchResult = useCallback(
    (result: SearchResult) => {
      const resultIndex = searchResults.findIndex(
        (r) => r.messageId === result.messageId,
      );
      if (resultIndex !== -1) {
        setCurrentSearchIndex(resultIndex);
      }
      setIsNavigatingToMessage(true);
      setPendingMessageNavigation({
        conversationId: result.conversationId,
        messageId: result.messageId,
        messageDate: result.message.date,
      });
      setSelectedConversationId(result.conversationId);
    },
    [searchResults],
  );

  // Bookmark functionality - server-persisted
  const addBookmark = useCallback(async (message: Message) => {
    try {
      await apiClient("/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          messageId: message.id,
          conversationId: message.conversationId,
          content: message.content,
          from: message.from,
          date: message.date,
        }),
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
    setIsNavigatingToMessage(true);
    setPendingMessageNavigation({
      conversationId: bookmark.conversationId,
      messageId: bookmark.messageId,
      messageDate: bookmark.date,
    });
    setSelectedConversationId(bookmark.conversationId);
  }, []);

  const goToDate = useCallback(
    async (date: Date): Promise<boolean> => {
      if (!selectedConversationId) {
        return false;
      }

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      setNavigationProgress(0);
      setIsNavigatingToMessage(true);

      try {
        const data = await apiClient<{
          messages: ApiMessage[];
        }>(
          `/conversations/${selectedConversationId}?limit=1&before=${endOfDay.toISOString()}`,
        );

        const targetMessage = data.messages[0];
        if (!targetMessage) {
          setNavigationProgress(0);
          setIsNavigatingToMessage(false);
          return false;
        }

        const targetDate = new Date(targetMessage.date);
        if (targetDate < startOfDay) {
          setNavigationProgress(0);
          setIsNavigatingToMessage(false);
          return false;
        }

        setPendingMessageNavigation({
          conversationId: selectedConversationId,
          messageId: targetMessage.id,
          messageDate: targetDate,
        });

        return true;
      } catch (e) {
        console.error("Failed to navigate to date:", e);
        setNavigationProgress(0);
        setIsNavigatingToMessage(false);
        return false;
      }
    },
    [selectedConversationId],
  );

  return (
    <MessageContext.Provider
      value={{
        conversations,
        selectedConversation,
        isLoading,
        isLoadingConversation,
        error,
        selectConversation,
        refreshConversations,
        loadMoreMessages,
        loadAllMessages,
        hasMoreMessages,
        isLoadingMore,
        loadingProgress,
        totalMessageCount,
        searchQuery,
        setSearchQuery,
        searchResults,
        currentSearchIndex,
        goToNextResult,
        goToPrevResult,
        goToSearchResult,
        highlightedMessageId,
        setHighlightedMessageId,
        isSearching,
        isNavigatingToMessage,
        navigationProgress,
        bookmarks,
        addBookmark,
        removeBookmark,
        isBookmarked,
        goToBookmark,
        goToDate,
        refreshBookmarks,
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

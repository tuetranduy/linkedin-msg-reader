import React, { useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMessages } from "@/context/MessageContext";
import { useRoom } from "@/context/RoomContext";
import { MessageBubble } from "./MessageBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Loader2,
  Users,
} from "lucide-react";
import { formatDateSeparator, isSameDay } from "@/lib/utils";
import type { RoomScrollSyncEvent } from "@/types/room";
import type { Message } from "@/types/message";

interface MessageItem {
  type: "message" | "date-separator";
  date?: Date;
  messageIndex?: number;
}

interface MessageListProps {
  onShareMessage?: (message: Message) => void;
}

export function MessageList({ onShareMessage }: MessageListProps) {
  const {
    selectedConversation,
    highlightedMessageId,
    setHighlightedMessageId,
    loadMoreMessages,
    loadAllMessages,
    hasMoreMessages,
    isLoadingMore,
    isLoadingConversation,
    isNavigatingToMessage,
    navigationProgress,
    loadingProgress,
    totalMessageCount,
    goToDate,
  } = useMessages();
  const { currentRoom, isInRoom, emitScroll, onScrollSync, offScrollSync } =
    useRoom();
  const parentRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const [showScrollTopButton, setShowScrollTopButton] = React.useState(false);
  const [syncController, setSyncController] = React.useState<string | null>(
    null,
  );
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [dateInput, setDateInput] = React.useState("");
  const [dateError, setDateError] = React.useState<string | null>(null);
  const [isGoingToDate, setIsGoingToDate] = React.useState(false);
  const [pendingDateNavigation, setPendingDateNavigation] =
    React.useState(false);
  const isReceivingSyncRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastConversationIdRef = useRef<string | null>(null);

  // Build items list with date separators
  const items: MessageItem[] = React.useMemo(() => {
    if (!selectedConversation) return [];

    const result: MessageItem[] = [];
    let lastDate: Date | null = null;

    selectedConversation.messages.forEach((message, index) => {
      // Add date separator if day changed
      if (!lastDate || !isSameDay(lastDate, message.date)) {
        result.push({ type: "date-separator", date: message.date });
        lastDate = message.date;
      }
      result.push({ type: "message", messageIndex: index });
    });

    return result;
  }, [selectedConversation]);

  // Map participants to indices for consistent coloring
  const participantIndexMap = React.useMemo(() => {
    if (!selectedConversation) return new Map<string, number>();
    const otherParticipants = [
      ...new Set(
        selectedConversation.messages
          .filter((m) => !m.isCurrentUser)
          .map((m) => m.from),
      ),
    ];
    return new Map(otherParticipants.map((p, i) => [p, i]));
  }, [selectedConversation]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(
      (index: number) => {
        const item = items[index];
        if (item.type === "date-separator") return 40;
        return 80; // Estimate for message
      },
      [items],
    ),
    overscan: 10,
  });

  // Scroll to highlighted message
  useEffect(() => {
    if (!highlightedMessageId || !selectedConversation) return;

    const messageIndex = selectedConversation.messages.findIndex(
      (m) => m.id === highlightedMessageId,
    );

    if (messageIndex === -1) return;

    // Find the item index (accounting for date separators)
    let itemIndex = 0;
    for (let i = 0; i < items.length; i++) {
      if (
        items[i].type === "message" &&
        items[i].messageIndex === messageIndex
      ) {
        itemIndex = i;
        break;
      }
    }

    virtualizer.scrollToIndex(itemIndex, {
      align: "center",
      behavior: "smooth",
    });

    // Clear highlight after animation
    const timeout = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 3001);

    return () => clearTimeout(timeout);
  }, [
    highlightedMessageId,
    selectedConversation,
    items,
    virtualizer,
    setHighlightedMessageId,
  ]);

  // Show/hide scroll to bottom button
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = parent;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
      const isNearTop = scrollTop < 200;
      setShowScrollButton(!isNearBottom);
      setShowScrollTopButton(!isNearTop && scrollTop > 400);

      // Load more when scrolling near top
      if (isNearTop && hasMoreMessages && !isLoadingMore) {
        loadMoreMessages();
      }

      // Emit scroll sync if in room with control and not receiving sync
      if (
        isInRoom &&
        currentRoom?.canControl &&
        !isReceivingSyncRef.current &&
        selectedConversation
      ) {
        // Debounce scroll sync
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          // Find the message that's currently in view (center of viewport)
          const centerY = scrollTop + clientHeight / 2;
          const virtualItems = virtualizer.getVirtualItems();
          let visibleMessageId: string | null = null;

          for (const item of virtualItems) {
            if (item.start <= centerY && item.start + item.size >= centerY) {
              const messageItem = items[item.index];
              if (
                messageItem.type === "message" &&
                messageItem.messageIndex !== undefined
              ) {
                visibleMessageId =
                  selectedConversation.messages[messageItem.messageIndex].id;
                break;
              }
            }
          }

          if (visibleMessageId) {
            emitScroll(visibleMessageId, scrollTop);
          }
        }, 100);
      }
    };

    parent.addEventListener("scroll", handleScroll);
    return () => parent.removeEventListener("scroll", handleScroll);
  }, [
    hasMoreMessages,
    isLoadingMore,
    loadMoreMessages,
    isInRoom,
    currentRoom?.canControl,
    selectedConversation,
    items,
    virtualizer,
    emitScroll,
  ]);

  const scrollToBottom = () => {
    if (items.length > 0) {
      virtualizer.scrollToIndex(items.length - 1, {
        align: "end",
        behavior: "smooth",
      });
    }
  };

  const scrollToTop = () => {
    virtualizer.scrollToIndex(0, {
      align: "start",
      behavior: "smooth",
    });
  };

  const goToBeginning = async () => {
    await loadAllMessages();
    // After loading all messages, scroll to top
    setTimeout(() => {
      virtualizer.scrollToIndex(0, {
        align: "start",
        behavior: "smooth",
      });
    }, 100);
  };

  const handleGoToDate = async () => {
    if (!dateInput) {
      setDateError("Please choose a date.");
      return;
    }

    setDateError(null);
    setIsGoingToDate(true);
    try {
      const found = await goToDate(new Date(`${dateInput}T00:00:00`));
      if (!found) {
        setPendingDateNavigation(false);
        setDateError("No messages found on this date.");
        return;
      }
      setPendingDateNavigation(true);
    } finally {
      setIsGoingToDate(false);
    }
  };

  useEffect(() => {
    if (pendingDateNavigation && !isNavigatingToMessage) {
      setShowDatePicker(false);
      setPendingDateNavigation(false);
    }
  }, [pendingDateNavigation, isNavigatingToMessage]);

  // Listen for scroll sync events from room
  useEffect(() => {
    if (!isInRoom) {
      setSyncController(null);
      return;
    }

    const handleScrollSync = (event: RoomScrollSyncEvent) => {
      if (!selectedConversation || !event.messageId) return;

      // Don't sync if we have control
      if (currentRoom?.canControl) return;

      // Set flag to prevent emitting while receiving
      isReceivingSyncRef.current = true;
      setSyncController(event.from.username);

      // Find the message index
      const messageIndex = selectedConversation.messages.findIndex(
        (m) => m.id === event.messageId,
      );

      if (messageIndex === -1) return;

      // Find the item index (accounting for date separators)
      let itemIndex = 0;
      for (let i = 0; i < items.length; i++) {
        if (
          items[i].type === "message" &&
          items[i].messageIndex === messageIndex
        ) {
          itemIndex = i;
          break;
        }
      }

      virtualizer.scrollToIndex(itemIndex, {
        align: "center",
        behavior: "smooth",
      });

      // Clear receiving flag after scroll settles
      setTimeout(() => {
        isReceivingSyncRef.current = false;
      }, 500);

      // Clear controller indicator after a delay
      setTimeout(() => {
        setSyncController(null);
      }, 2000);
    };

    onScrollSync(handleScrollSync);

    return () => {
      offScrollSync();
    };
  }, [
    isInRoom,
    currentRoom?.canControl,
    selectedConversation,
    items,
    virtualizer,
    onScrollSync,
    offScrollSync,
  ]);

  // Scroll to bottom on conversation change
  useEffect(() => {
    const currentConversationId = selectedConversation?.id ?? null;

    if (!currentConversationId) {
      lastConversationIdRef.current = null;
      return;
    }

    const conversationChanged =
      lastConversationIdRef.current !== currentConversationId;
    lastConversationIdRef.current = currentConversationId;

    if (!conversationChanged || items.length === 0 || isNavigatingToMessage) {
      return;
    }

    // Small delay to allow virtualizer to initialize
    const timeout = setTimeout(() => {
      virtualizer.scrollToIndex(items.length - 1, { align: "end" });
    }, 100);

    return () => clearTimeout(timeout);
  }, [
    selectedConversation?.id,
    items.length,
    isNavigatingToMessage,
    virtualizer,
  ]);

  useEffect(() => {
    setShowDatePicker(false);
    setDateInput("");
    setDateError(null);
    setPendingDateNavigation(false);
  }, [selectedConversation?.id]);

  if (isLoadingConversation) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selectedConversation) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Select a conversation to view messages
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={parentRef}
        className="h-full overflow-auto"
        style={{ contain: "strict" }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index];

            if (item.type === "date-separator") {
              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="flex items-center justify-center"
                >
                  <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {formatDateSeparator(item.date!)}
                  </div>
                </div>
              );
            }

            const message = selectedConversation.messages[item.messageIndex!];
            const prevItem = items[virtualItem.index - 1];
            const showAvatar =
              prevItem?.type === "date-separator" ||
              (prevItem?.type === "message" &&
                selectedConversation.messages[prevItem.messageIndex!].from !==
                  message.from);

            // Get participant index for coloring
            const participantIndex = message.isCurrentUser
              ? -1
              : (participantIndexMap.get(message.from) ?? 0);

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <MessageBubble
                  message={message}
                  showAvatar={showAvatar}
                  isHighlighted={message.id === highlightedMessageId}
                  participantIndex={participantIndex}
                  onShareMessage={onShareMessage}
                />
              </div>
            );
          })}
        </div>
      </div>

      {showScrollButton && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-4 right-4 rounded-full shadow-lg"
          onClick={scrollToBottom}
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      )}

      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        {hasMoreMessages && (
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full px-3 shadow-lg"
            onClick={goToBeginning}
            disabled={isLoadingMore || isGoingToDate || isNavigatingToMessage}
          >
            <ChevronsUp className="mr-1 h-4 w-4" />
            Beginning
          </Button>
        )}

        <Button
          variant={showDatePicker ? "secondary" : "outline"}
          size="sm"
          className="rounded-full px-3 shadow-lg"
          onClick={() => {
            setDateError(null);
            setShowDatePicker((prev) => !prev);
          }}
          disabled={isGoingToDate || isNavigatingToMessage}
        >
          <CalendarDays className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">Go to date</span>
        </Button>

        {showScrollTopButton && (
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full shadow-lg"
            onClick={scrollToTop}
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
        )}
      </div>

      {showDatePicker && (
        <div className="absolute right-4 top-16 z-20 w-[min(22rem,calc(100%-2rem))] rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur-sm">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Jump to messages on date
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateInput}
                onChange={(event) => setDateInput(event.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
              <Button
                size="sm"
                onClick={handleGoToDate}
                disabled={!dateInput || isGoingToDate || isNavigatingToMessage}
              >
                {isGoingToDate ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Go"
                )}
              </Button>
            </div>
            {dateError && <p className="text-xs text-red-600">{dateError}</p>}
            {isNavigatingToMessage && (
              <p className="text-xs text-muted-foreground">
                Loading target date... {Math.max(navigationProgress, 1)}%
              </p>
            )}
          </div>
        </div>
      )}

      {isLoadingMore && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg min-w-[200px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs text-muted-foreground">
              {loadingProgress > 0
                ? `Loading all messages... ${loadingProgress}%`
                : "Loading older messages..."}
            </span>
          </div>
          {loadingProgress > 0 && (
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {isNavigatingToMessage && (
        <div className="absolute top-20 left-1/2 z-20 flex min-w-[220px] -translate-x-1/2 flex-col items-center gap-1.5 rounded-lg bg-background/90 px-4 py-2 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs text-muted-foreground">
              Loading target message... {Math.max(navigationProgress, 1)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${Math.max(navigationProgress, 1)}%` }}
            />
          </div>
        </div>
      )}

      {hasMoreMessages && selectedConversation && (
        <div className="absolute top-4 left-4 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
          {selectedConversation.messages.length} / {totalMessageCount} messages
        </div>
      )}

      {/* Room sync indicator */}
      {isInRoom && (
        <div className="absolute bottom-16 left-2 right-2 z-20 flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-lg border border-border bg-background/90 px-3 py-2 shadow-lg backdrop-blur-sm sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-xs">
          <Users className="h-4 w-4 text-primary" />
          <span className="min-w-0 text-xs">
            {currentRoom?.canControl ? (
              <span className="text-green-600 dark:text-green-400">
                You control scroll
              </span>
            ) : syncController ? (
              <span className="block truncate text-muted-foreground">
                {syncController} is scrolling...
              </span>
            ) : (
              <span className="block truncate text-muted-foreground">
                Following room scroll
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

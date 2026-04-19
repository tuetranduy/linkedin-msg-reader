import React, { useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMessages } from "@/context/MessageContext";
import { useRoom } from "@/context/RoomContext";
import { MessageBubble } from "./MessageBubble";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Loader2,
  Users,
} from "lucide-react";
import { formatDateSeparator, isSameDay } from "@/lib/utils";
import type { RoomScrollSyncEvent } from "@/types/room";

interface MessageItem {
  type: "message" | "date-separator";
  date?: Date;
  messageIndex?: number;
}

export function MessageList() {
  const {
    selectedConversation,
    highlightedMessageId,
    setHighlightedMessageId,
    loadMoreMessages,
    loadAllMessages,
    hasMoreMessages,
    isLoadingMore,
    isLoadingConversation,
    loadingProgress,
    totalMessageCount,
  } = useMessages();
  const { currentRoom, isInRoom, emitScroll, onScrollSync, offScrollSync } =
    useRoom();
  const parentRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const [showScrollTopButton, setShowScrollTopButton] = React.useState(false);
  const [syncController, setSyncController] = React.useState<string | null>(
    null,
  );
  const isReceivingSyncRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    }, 3000);

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
    if (selectedConversation && !highlightedMessageId && items.length > 0) {
      // Small delay to allow virtualizer to initialize
      setTimeout(() => {
        virtualizer.scrollToIndex(items.length - 1, { align: "end" });
      }, 100);
    }
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

      {showScrollTopButton && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-4 right-4 rounded-full shadow-lg"
          onClick={scrollToTop}
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      )}

      {hasMoreMessages && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-4 right-16 rounded-full shadow-lg px-3"
          onClick={goToBeginning}
          disabled={isLoadingMore}
        >
          <ChevronsUp className="h-4 w-4 mr-1" />
          Beginning
        </Button>
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

      {hasMoreMessages && selectedConversation && (
        <div className="absolute top-4 left-4 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
          {selectedConversation.messages.length} / {totalMessageCount} messages
        </div>
      )}

      {/* Room sync indicator */}
      {isInRoom && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-background/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-border">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-xs">
            {currentRoom?.canControl ? (
              <span className="text-green-600 dark:text-green-400">
                You control scroll
              </span>
            ) : syncController ? (
              <span className="text-muted-foreground">
                {syncController} is scrolling...
              </span>
            ) : (
              <span className="text-muted-foreground">
                Following room scroll
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

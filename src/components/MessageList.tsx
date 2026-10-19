import React, { useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMessages } from "@/context/MessageContext";
import { useRoom } from "@/context/RoomContext";
import { MessageBubble } from "./MessageBubble";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CalendarDays,
  ChevronDown,
  MessagesSquare,
  ChevronUp,
  ChevronsUp,
  Loader2,
  Pause,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
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
  /** Renders the conversation header; receives the list's own toolbar (jump to beginning / date) */
  renderHeader?: (toolbar: React.ReactNode) => React.ReactNode;
  /** Shown in the empty state on small screens, where the conversation list is hidden */
  onBrowseConversations?: () => void;
}

export function MessageList({
  onShareMessage,
  renderHeader,
  onBrowseConversations,
}: MessageListProps) {
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
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    undefined,
  );
  const [dateError, setDateError] = React.useState<string | null>(null);
  const [isGoingToDate, setIsGoingToDate] = React.useState(false);
  const [pendingDateNavigation, setPendingDateNavigation] =
    React.useState(false);
  const [isSyncPaused, setIsSyncPaused] = React.useState(false);
  const [hasPendingSync, setHasPendingSync] = React.useState(false);
  const isReceivingSyncRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastConversationIdRef = useRef<string | null>(null);
  const latestRoomSyncRef = useRef<RoomScrollSyncEvent | null>(null);

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

  const scrollToMessageId = useCallback(
    (messageId: string, behavior: "smooth" | "auto" = "smooth") => {
      if (!selectedConversation) return false;

      const messageIndex = selectedConversation.messages.findIndex(
        (m) => m.id === messageId,
      );
      if (messageIndex === -1) return false;

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
        behavior,
      });

      return true;
    },
    [selectedConversation, items, virtualizer],
  );

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

  const updateScrollButtons = useCallback(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const { scrollTop, scrollHeight, clientHeight } = parent;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight >= 200);
    setShowScrollTopButton(scrollTop > 400);
  }, []);

  // Re-check once the virtualizer has measured real row heights; the scroll
  // event fired by the initial jump-to-bottom only saw estimated sizes.
  const totalSize = virtualizer.getTotalSize();
  useEffect(() => {
    const frame = requestAnimationFrame(updateScrollButtons);
    return () => cancelAnimationFrame(frame);
  }, [totalSize, selectedConversation?.id, updateScrollButtons]);

  // Show/hide scroll to bottom button
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const handleScroll = () => {
      const { scrollTop, clientHeight } = parent;
      const isNearTop = scrollTop < 200;
      updateScrollButtons();

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
    updateScrollButtons,
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
    if (!selectedDate) {
      setDateError("Please choose a date.");
      return;
    }

    setDateError(null);
    setIsGoingToDate(true);
    try {
      const found = await goToDate(
        new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
        ),
      );
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
      setIsSyncPaused(false);
      setHasPendingSync(false);
      latestRoomSyncRef.current = null;
      return;
    }

    const handleScrollSync = (event: RoomScrollSyncEvent) => {
      if (!selectedConversation) return;

      latestRoomSyncRef.current = event;
      setSyncController(event.from.username);

      if (isSyncPaused) {
        setHasPendingSync(Boolean(event.messageId));
        return;
      }

      if (!event.messageId) return;

      // Set flag to prevent emitting while receiving
      isReceivingSyncRef.current = true;

      const didScroll = scrollToMessageId(event.messageId, "smooth");
      if (!didScroll && parentRef.current) {
        parentRef.current.scrollTo({ top: event.position, behavior: "smooth" });
      }
      setHasPendingSync(false);

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
    selectedConversation,
    isSyncPaused,
    scrollToMessageId,
    onScrollSync,
    offScrollSync,
  ]);

  const handlePauseSync = () => {
    setIsSyncPaused(true);
    setHasPendingSync(false);
  };

  const handleResync = () => {
    setIsSyncPaused(false);
    const latest = latestRoomSyncRef.current;
    if (!latest?.messageId) {
      setHasPendingSync(false);
      return;
    }

    isReceivingSyncRef.current = true;
    const didScroll = scrollToMessageId(latest.messageId, "smooth");
    if (!didScroll && parentRef.current) {
      parentRef.current.scrollTo({ top: latest.position, behavior: "smooth" });
    }
    setHasPendingSync(false);

    setTimeout(() => {
      isReceivingSyncRef.current = false;
    }, 500);
  };

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
    setSelectedDate(undefined);
    setDateError(null);
    setPendingDateNavigation(false);
  }, [selectedConversation?.id]);

  if (!selectedConversation && !isLoadingConversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
          <MessagesSquare aria-hidden="true" className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Pick a conversation</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Choose a conversation to read its messages, bookmark highlights, or
            read it together with others.
          </p>
        </div>
        {onBrowseConversations && (
          <Button onClick={onBrowseConversations} className="mt-1">
            Browse conversations
          </Button>
        )}
      </div>
    );
  }

  const toolbar = selectedConversation && (
    <div className="flex items-center gap-1">
      {hasMoreMessages && (
        <Button
          variant="ghost"
          size="sm"
          onClick={goToBeginning}
          disabled={isLoadingMore || isGoingToDate || isNavigatingToMessage}
          aria-label="Load all and jump to the first message"
          title="Jump to the first message"
        >
          <ChevronsUp className="h-4 w-4" />
          <span className="hidden lg:inline">Beginning</span>
        </Button>
      )}

      <Popover
        open={showDatePicker}
        onOpenChange={(open) => {
          setDateError(null);
          setShowDatePicker(open);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant={showDatePicker ? "secondary" : "ghost"}
            size="sm"
            disabled={isGoingToDate || isNavigatingToMessage}
            aria-label="Go to date"
            title="Go to date"
          >
            <CalendarDays className="h-4 w-4" />
            <span className="hidden lg:inline">Go to date</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-sm font-medium">Jump to a date</p>
            <p className="text-xs text-muted-foreground">
              {selectedDate
                ? format(selectedDate, "PPP")
                : "Pick a day to see its messages"}
            </p>
          </div>
          <Calendar
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              setDateError(null);
            }}
            disabled={(date) => date > new Date()}
          />
          <div className="space-y-2 border-t border-border p-3">
            {dateError && (
              <p role="alert" className="text-xs text-destructive">
                {dateError}
              </p>
            )}
            {isNavigatingToMessage && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Loading messages… {Math.max(navigationProgress, 1)}%
              </p>
            )}
            <Button
              className="w-full"
              size="sm"
              onClick={handleGoToDate}
              disabled={!selectedDate || isGoingToDate || isNavigatingToMessage}
            >
              {isGoingToDate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Go to date"
              )}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {selectedConversation && renderHeader?.(toolbar)}

      {isLoadingConversation || !selectedConversation ? (
        <div
          className="flex-1 space-y-5 overflow-hidden p-4 lg:px-6"
          aria-busy="true"
          aria-label="Loading messages"
        >
          {[60, 40, 72, 35, 55, 48].map((width, i) => (
            <div
              key={i}
              className={`flex items-end gap-2.5 ${i % 2 ? "flex-row-reverse" : ""}`}
            >
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
              <div
                className="h-10 animate-pulse rounded-2xl bg-muted"
                style={{ width: `${width}%` }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={parentRef}
            className={`h-full overflow-auto ${isInRoom ? "pb-20" : "pb-4"}`}
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
                      className="flex items-end justify-center pb-1"
                    >
                      <div className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
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
                    selectedConversation.messages[prevItem.messageIndex!]
                      .from !== message.from);

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

          {/* Scroll shortcuts */}
          <div
            className={`absolute right-4 z-20 flex flex-col gap-2 ${isInRoom ? "bottom-20 sm:bottom-4" : "bottom-4"}`}
          >
            {showScrollTopButton && (
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg"
                onClick={scrollToTop}
                aria-label="Scroll to top"
                title="Scroll to top"
              >
                <ChevronUp className="h-5 w-5" />
              </Button>
            )}
            {showScrollButton && (
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg"
                onClick={scrollToBottom}
                aria-label="Scroll to latest message"
                title="Scroll to latest message"
              >
                <ChevronDown className="h-5 w-5" />
              </Button>
            )}
          </div>

          {(isLoadingMore || isNavigatingToMessage) && (
            <div
              role="status"
              aria-live="polite"
              className="absolute left-1/2 top-3 z-20 flex min-w-[220px] -translate-x-1/2 flex-col items-center gap-1.5 rounded-full border border-border bg-popover/95 px-4 py-2 shadow-lg backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">
                  {isNavigatingToMessage
                    ? `Finding message… ${Math.max(navigationProgress, 1)}%`
                    : loadingProgress > 0
                      ? `Loading all messages… ${loadingProgress}%`
                      : "Loading older messages…"}
                </span>
              </div>
              {(isNavigatingToMessage || loadingProgress > 0) && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-[width] duration-300 ease-out"
                    style={{
                      width: `${isNavigatingToMessage ? Math.max(navigationProgress, 1) : loadingProgress}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Room sync indicator */}
          {isInRoom && (
            <div className="absolute bottom-4 left-3 right-3 z-20 flex items-center gap-2 rounded-xl border border-border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-sm sm:left-4 sm:right-auto sm:max-w-xs">
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${isSyncPaused ? "bg-warning" : "bg-success"}`}
              />
              <div className="min-w-0 flex-1 text-xs" aria-live="polite">
                {isSyncPaused ? (
                  <span className="block truncate font-medium text-warning">
                    Sync paused
                  </span>
                ) : currentRoom?.canControl ? (
                  <span className="block truncate font-medium text-success">
                    You control the scroll
                  </span>
                ) : syncController ? (
                  <span className="block truncate text-muted-foreground">
                    {syncController} is scrolling…
                  </span>
                ) : (
                  <span className="block truncate text-muted-foreground">
                    Following room scroll
                  </span>
                )}
              </div>
              {hasPendingSync && isSyncPaused && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                  New
                </span>
              )}
              {isSyncPaused ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleResync}
                  title="Re-sync to current room scroll"
                >
                  <RotateCcw className="h-3 w-3" />
                  Re-sync
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handlePauseSync}
                  title="Pause sync on this device"
                >
                  <Pause className="h-3 w-3" />
                  Pause
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

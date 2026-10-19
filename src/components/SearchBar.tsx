import { useState, useRef, useEffect } from "react";
import { useMessages } from "@/context/MessageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Loader2,
  MessageSquare,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
}

const shortcutLabel =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? "⌘K"
    : "Ctrl K";

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function SearchBar() {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    currentSearchIndex,
    goToNextResult,
    goToPrevResult,
    goToSearchResult,
    isSearching,
    isNavigatingToMessage,
  } = useMessages();

  const [showDropdown, setShowDropdown] = useState(false);
  const [clickedResultId, setClickedResultId] = useState<string | null>(null);
  // The first Enter opens the current result; later presses step through them
  const [hasJumped, setHasJumped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasResults = searchResults.length > 0;
  const hasQuery = searchQuery.trim().length > 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ⌘K / Ctrl+K focuses whichever search box is currently visible
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        const input = inputRef.current;
        if (!input || input.offsetParent === null) return;
        event.preventDefault();
        input.focus();
        input.select();
      }
    }

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  // Show dropdown when there are results
  useEffect(() => {
    if (hasResults && hasQuery) {
      setShowDropdown(true);
    }
  }, [hasResults, hasQuery]);

  // Clear clicked result when navigation completes
  useEffect(() => {
    if (!isNavigatingToMessage && clickedResultId) {
      setClickedResultId(null);
      setShowDropdown(false);
    }
  }, [isNavigatingToMessage, clickedResultId]);

  const handleResultClick = (result: (typeof searchResults)[0]) => {
    setClickedResultId(result.messageId);
    setHasJumped(true);
    goToSearchResult(result);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (showDropdown) {
        setShowDropdown(false);
      } else {
        setSearchQuery("");
        inputRef.current?.blur();
      }
    } else if (e.key === "Enter" && hasResults && !isSearching) {
      e.preventDefault();
      if (!hasJumped) {
        goToSearchResult(searchResults[currentSearchIndex] ?? searchResults[0]);
      } else if (e.shiftKey) {
        goToPrevResult();
      } else {
        goToNextResult();
      }
      setHasJumped(true);
      setShowDropdown(false);
    }
  };

  const handleInputFocus = () => {
    if (hasResults && hasQuery) {
      setShowDropdown(true);
    }
  };

  return (
    <div
      ref={containerRef}
      role="search"
      className="relative flex items-center gap-1"
    >
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          type="search"
          aria-label="Search messages"
          aria-expanded={showDropdown && hasQuery}
          aria-controls="search-results"
          aria-autocomplete="list"
          role="combobox"
          placeholder="Search messages"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setHasJumped(false);
          }}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          className="peer h-9 bg-muted/60 pl-9 pr-9 text-sm focus-visible:bg-card [&::-webkit-search-cancel-button]:hidden"
        />
        {hasQuery ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear search"
            className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2"
            onClick={() => {
              setSearchQuery("");
              setShowDropdown(false);
              inputRef.current?.focus();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground lg:inline peer-focus:hidden">
            {shortcutLabel}
          </kbd>
        )}

        {/* Search Results Dropdown */}
        {showDropdown && hasQuery && (
          <div
            id="search-results"
            className="absolute left-0 top-full z-50 mt-1.5 max-h-[min(420px,70vh)] w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
          >
            {isSearching ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Searching...</span>
              </div>
            ) : hasResults ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {searchResults.length} result
                    {searchResults.length !== 1 ? "s" : ""}
                  </span>
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">
                    Enter for next · Shift+Enter for previous
                  </span>
                </div>
                <div className="overflow-y-auto max-h-[min(370px,calc(70vh-40px))]">
                  <div className="divide-y divide-border">
                    {searchResults.map((result, index) => {
                      const isLoading =
                        clickedResultId === result.messageId &&
                        isNavigatingToMessage;
                      return (
                        <button
                          key={result.messageId}
                          onClick={() => handleResultClick(result)}
                          disabled={isNavigatingToMessage}
                          className={cn(
                            "w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/80 focus-visible:bg-muted focus-visible:outline-none",
                            index === currentSearchIndex && "bg-accent/60",
                            isLoading && "bg-accent",
                            isNavigatingToMessage && !isLoading && "opacity-50",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div className="shrink-0 mt-0.5">
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              ) : (
                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-primary truncate flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {result.message.from}
                                </span>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {isLoading
                                    ? "Loading..."
                                    : formatDate(result.message.date)}
                                </span>
                              </div>
                              <p className="text-sm text-foreground line-clamp-2">
                                {highlightText(
                                  result.message.content,
                                  searchQuery,
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                in: {result.conversationTitle}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-sm">No messages found</span>
                <span className="text-xs mt-1">Try different keywords</span>
              </div>
            )}
          </div>
        )}
      </div>

      {hasQuery && (
        <>
          <span
            aria-live="polite"
            className={cn(
              "whitespace-nowrap px-1 text-xs tabular-nums",
              hasResults || isSearching
                ? "text-muted-foreground"
                : "text-destructive",
            )}
          >
            {isSearching
              ? "Searching…"
              : hasResults
                ? `${currentSearchIndex + 1}/${searchResults.length}`
                : "No results"}
          </span>

          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                goToPrevResult();
                setHasJumped(true);
                setShowDropdown(false);
              }}
              disabled={!hasResults}
              aria-label="Previous result"
              title="Previous result (Shift+Enter)"
              className="h-8 w-8"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                goToNextResult();
                setHasJumped(true);
                setShowDropdown(false);
              }}
              disabled={!hasResults}
              aria-label="Next result"
              title="Next result (Enter)"
              className="h-8 w-8"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

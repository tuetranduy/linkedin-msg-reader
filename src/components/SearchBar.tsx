import { useState, useRef, useEffect } from "react";
import { useMessages } from "@/context/MessageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronUp, ChevronDown, X, Loader2, MessageSquare, User } from "lucide-react";
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
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
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
  } = useMessages();

  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasResults = searchResults.length > 0;
  const hasQuery = searchQuery.trim().length > 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Show dropdown when there are results
  useEffect(() => {
    if (hasResults && hasQuery) {
      setShowDropdown(true);
    }
  }, [hasResults, hasQuery]);

  const handleResultClick = (result: typeof searchResults[0]) => {
    goToSearchResult(result);
    setShowDropdown(false);
  };

  const handleInputFocus = () => {
    if (hasResults && hasQuery) {
      setShowDropdown(true);
    }
  };

  return (
    <div ref={containerRef} className="flex items-center gap-1.5 lg:gap-2 relative">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-2.5 lg:left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={handleInputFocus}
          className="pl-8 lg:pl-9 pr-7 lg:pr-8 h-9 lg:h-10 text-sm"
        />
        {hasQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0.5 lg:right-1 top-1/2 h-6 w-6 -translate-y-1/2"
            onClick={() => {
              setSearchQuery("");
              setShowDropdown(false);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}

        {/* Search Results Dropdown */}
        {showDropdown && hasQuery && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden min-w-[320px] lg:min-w-[400px]">
            {isSearching ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Searching...</span>
              </div>
            ) : hasResults ? (
              <>
                <div className="px-3 py-2 border-b border-border bg-muted/50">
                  <span className="text-xs text-muted-foreground font-medium">
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
                  </span>
                </div>
                <ScrollArea className="max-h-[350px]">
                  <div className="divide-y divide-border">
                    {searchResults.map((result, index) => (
                      <button
                        key={result.messageId}
                        onClick={() => handleResultClick(result)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors",
                          index === currentSearchIndex && "bg-muted"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-primary truncate flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {result.message.from}
                              </span>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {formatDate(result.message.date)}
                              </span>
                            </div>
                            <p className="text-sm text-foreground line-clamp-2">
                              {highlightText(result.message.content, searchQuery)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              in: {result.conversationTitle}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
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
            className={cn(
              "text-xs lg:text-sm whitespace-nowrap",
              hasResults ? "text-muted-foreground" : "text-destructive",
            )}
          >
            {hasResults
              ? `${currentSearchIndex + 1}/${searchResults.length}`
              : "0"}
          </span>

          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                goToPrevResult();
                setShowDropdown(false);
              }}
              disabled={!hasResults}
              className="h-7 w-7 lg:h-8 lg:w-8"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                goToNextResult();
                setShowDropdown(false);
              }}
              disabled={!hasResults}
              className="h-7 w-7 lg:h-8 lg:w-8"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

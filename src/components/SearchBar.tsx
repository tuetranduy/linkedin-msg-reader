
import { useMessages } from "@/context/MessageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchBar() {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    currentSearchIndex,
    goToNextResult,
    goToPrevResult,
  } = useMessages();

  const hasResults = searchResults.length > 0;
  const hasQuery = searchQuery.trim().length > 0;

  return (
    <div className="flex items-center gap-1.5 lg:gap-2">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-2.5 lg:left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 lg:pl-9 pr-7 lg:pr-8 h-9 lg:h-10 text-sm"
        />
        {hasQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0.5 lg:right-1 top-1/2 h-6 w-6 -translate-y-1/2"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-3 w-3" />
          </Button>
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
              onClick={goToPrevResult}
              disabled={!hasResults}
              className="h-7 w-7 lg:h-8 lg:w-8"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextResult}
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

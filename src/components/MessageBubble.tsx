import DOMPurify from "dompurify";
import type { Message } from "@/types/message";
import { useMessages } from "@/context/MessageContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { cn, formatMessageTime, isUrl, isImageUrl } from "@/lib/utils";

// Configure DOMPurify for safe HTML rendering
const purifyConfig = {
  ALLOWED_TAGS: [
    "b",
    "i",
    "em",
    "strong",
    "a",
    "p",
    "br",
    "ul",
    "ol",
    "li",
    "span",
    "div",
    "code",
    "pre",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class"],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ["target"],
};

// Check if content contains HTML tags
const containsHtml = (text: string): boolean => {
  return /<[a-z][\s\S]*>/i.test(text);
};

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  isHighlighted?: boolean;
}

export function MessageBubble({
  message,
  showAvatar = true,
  isHighlighted = false,
}: MessageBubbleProps) {
  const { isBookmarked, addBookmark, removeBookmark, searchQuery } =
    useMessages();
  const bookmarked = isBookmarked(message.id);

  const toggleBookmark = () => {
    if (bookmarked) {
      removeBookmark(message.id);
    } else {
      addBookmark(message);
    }
  };

  const getInitials = (name: string | undefined | null) => {
    if (!name) return "?";
    return (
      name
        .split(" ")
        .map((n) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "?"
    );
  };

  // Parse URLs in content and safely render HTML
  const renderContent = () => {
    const content = message.content;

    // If content contains HTML, sanitize and render it
    if (containsHtml(content)) {
      let sanitizedHtml = DOMPurify.sanitize(content, {
        ...purifyConfig,
        RETURN_TRUSTED_TYPE: false,
      }) as string;

      // Apply search highlighting to sanitized HTML
      if (searchQuery.trim()) {
        const regex = new RegExp(
          `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
          "gi",
        );
        sanitizedHtml = sanitizedHtml.replace(regex, "<mark>$1</mark>");
      }

      return (
        <div
          className="prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      );
    }

    // Plain text content - parse URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, i) => {
      if (isUrl(part)) {
        if (isImageUrl(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="my-2 block"
            >
              <img
                src={part}
                alt="Shared image"
                className="max-w-full rounded-lg"
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLElement;
                  target.style.display = "none";
                  target.insertAdjacentHTML(
                    "afterend",
                    `<span class="flex items-center gap-1 text-primary underline"><svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>Image</span>`,
                  );
                }}
              />
            </a>
          );
        }
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary underline break-all hover:text-primary/80"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            {part.length > 50 ? part.slice(0, 50) + "..." : part}
          </a>
        );
      }

      // Apply search highlighting if there's a query
      if (searchQuery.trim()) {
        const regex = new RegExp(
          `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
          "gi",
        );
        const subParts = part.split(regex);
        return subParts.map((subPart, j) => {
          if (subPart.toLowerCase() === searchQuery.toLowerCase()) {
            return <mark key={`${i}-${j}`}>{subPart}</mark>;
          }
          return subPart;
        });
      }

      return part;
    });
  };

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-2 transition-colors",
        message.isCurrentUser ? "flex-row-reverse" : "flex-row",
        isHighlighted && "message-highlight bg-accent/20",
      )}
      id={`message-${message.id}`}
    >
      {showAvatar && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {getInitials(message.from)}
          </AvatarFallback>
        </Avatar>
      )}

      {!showAvatar && <div className="w-8" />}

      <div
        className={cn(
          "flex max-w-[70%] flex-col",
          message.isCurrentUser && "items-end",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2",
            message.isCurrentUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md",
          )}
        >
          {showAvatar && !message.isCurrentUser && (
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {message.from}
            </p>
          )}

          <div
            className={cn(
              "text-sm whitespace-pre-wrap break-words",
              message.isCurrentUser &&
                "[&_mark]:bg-primary-foreground/30 [&_mark]:text-primary-foreground",
            )}
          >
            {renderContent()}
          </div>

          {message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.attachments.map((attachment, i) =>
                isImageUrl(attachment) ? (
                  <a
                    key={i}
                    href={attachment}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={attachment}
                      alt={`Attachment ${i + 1}`}
                      className="max-h-48 max-w-full rounded-lg"
                    />
                  </a>
                ) : (
                  <a
                    key={i}
                    href={attachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs underline"
                  >
                    <ImageIcon className="h-3 w-3" />
                    Attachment {i + 1}
                  </a>
                ),
              )}
            </div>
          )}
        </div>

        <div
          className={cn(
            "mt-1 flex items-center gap-2",
            message.isCurrentUser && "flex-row-reverse",
          )}
        >
          <span className="text-xs text-muted-foreground">
            {formatMessageTime(message.date)}
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100",
                  bookmarked && "opacity-100",
                )}
                onClick={toggleBookmark}
              >
                {bookmarked ? (
                  <BookmarkCheck className="h-4 w-4 text-primary" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {bookmarked ? "Remove bookmark" : "Bookmark message"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

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
  Share2,
} from "lucide-react";
import {
  cn,
  formatMessageDateTime,
  formatMessageTime,
  getAvatarColor,
  getInitials,
  isUrl,
  isImageUrl,
} from "@/lib/utils";

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
  participantIndex?: number;
  onShareMessage?: (message: Message) => void;
}

export function MessageBubble({
  message,
  showAvatar = true,
  isHighlighted = false,
  participantIndex = 0,
  onShareMessage,
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
          className="max-w-none [&_a]:underline [&_a]:underline-offset-2"
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
                loading="lazy"
                className="max-h-72 max-w-full rounded-lg object-cover"
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
            className="inline-flex items-baseline gap-1 font-medium underline underline-offset-2 [overflow-wrap:anywhere] hover:opacity-80"
          >
            <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0 self-center" />
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

  const bubbleTone = message.isCurrentUser
    ? "bg-primary text-primary-foreground rounded-br-md [&_a]:text-primary-foreground"
    : participantIndex === 0
      ? "bg-bubble text-bubble-foreground rounded-bl-md [&_a]:text-primary"
      : "bg-bubble-alt text-bubble-alt-foreground rounded-bl-md [&_a]:text-primary";

  // Hidden until hover on pointer devices, but always reachable by keyboard focus
  const revealOnHover =
    "transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100";

  return (
    <div
      className={cn(
        "group flex gap-2.5 px-3 sm:px-4 lg:px-6",
        showAvatar ? "pt-3 pb-0.5" : "py-0.5",
        message.isCurrentUser ? "flex-row-reverse" : "flex-row",
        isHighlighted && "message-highlight",
      )}
      id={`message-${message.id}`}
    >
      {showAvatar ? (
        <Avatar className="mt-0.5 h-8 w-8 shrink-0">
          <AvatarFallback
            className={cn("text-xs font-semibold", getAvatarColor(message.from))}
          >
            {getInitials(message.from)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 shrink-0" aria-hidden="true" />
      )}

      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col sm:max-w-[70%]",
          message.isCurrentUser && "items-end",
        )}
      >
        {showAvatar && (
          <p
            className={cn(
              "mb-1 px-1 text-xs font-medium text-muted-foreground",
              message.isCurrentUser && "text-right",
            )}
          >
            {message.isCurrentUser ? "You" : message.from}
          </p>
        )}

        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 shadow-xs",
            !showAvatar &&
              (message.isCurrentUser ? "rounded-tr-md" : "rounded-tl-md"),
            bubbleTone,
          )}
        >
          <div
            className={cn(
              "text-[0.9375rem] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]",
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
                      loading="lazy"
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
                    <ImageIcon aria-hidden="true" className="h-3 w-3" />
                    Attachment {i + 1}
                  </a>
                ),
              )}
            </div>
          )}
        </div>

        <div
          className={cn(
            "mt-0.5 flex items-center gap-0.5 px-1",
            message.isCurrentUser && "flex-row-reverse",
          )}
        >
          <time
            dateTime={message.date.toISOString()}
            title={formatMessageDateTime(message.date)}
            className="px-0.5 text-xs tabular-nums text-muted-foreground"
          >
            {formatMessageTime(message.date)}
          </time>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={bookmarked ? "Remove bookmark" : "Bookmark message"}
                aria-pressed={bookmarked}
                className={cn("h-7 w-7", revealOnHover, bookmarked && "opacity-100!")}
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

          {onShareMessage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Share message"
                  className={cn("h-7 w-7", revealOnHover)}
                  onClick={() => onShareMessage(message)}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share message</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

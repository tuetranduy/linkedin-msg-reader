import { useCallback, useEffect, useState } from "react";
import type React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { MessageProvider, useMessages } from "./context/MessageContext";
import { RoomProvider, useRoom } from "./context/RoomContext";
import { ConversationList } from "./components/ConversationList";
import { MessageList } from "./components/MessageList";
import type { Message } from "./types/message";
import { SearchBar } from "./components/SearchBar";
import { BookmarkPanel } from "./components/BookmarkPanel";
import { RoomPanel } from "./components/RoomPanel";
import { JoinRoomModal } from "./components/JoinRoomModal";
import { CreateRoomModal } from "./components/CreateRoomModal";
import { RoomManagerModal } from "./components/RoomManagerModal";
import { LoginForm } from "./components/auth/LoginForm";
import { ChangePasswordModal } from "./components/auth/ChangePasswordModal";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { Button } from "./components/ui/button";
import { apiClient } from "./api/client";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./components/ui/sheet";
import { Avatar, AvatarFallback } from "./components/ui/avatar";
import { cn, formatDate, getAvatarColor, getInitials } from "./lib/utils";
import { useIsDesktop, useIsMobile } from "./hooks/useMediaQuery";
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  Inbox,
  KeyRound,
  LayoutList,
  Loader2,
  LogOut,
  MessageSquare,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Share2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";

interface ShareTargetUser {
  id: string;
  username: string;
}

interface ReceivedShare {
  id: string;
  conversationId: string;
  conversationTitle: string;
  sharedType?: "conversation" | "message";
  messageId?: string | null;
  messageDate?: string | null;
  messagePreview?: string | null;
  sharedBy: string;
  createdAt: string;
  openedAt: string | null;
  isRead: boolean;
}

function AppContent() {
  const { isAdmin, logout, user } = useAuth();
  const {
    conversations,
    selectedConversation,
    bookmarks,
    isLoading,
    selectConversation,
    goToBookmark,
    hasMoreMessages,
    totalMessageCount,
  } = useMessages();
  const { currentRoom, isInRoom, isConnected } = useRoom();
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showRoomPanel, setShowRoomPanel] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showRoomManager, setShowRoomManager] = useState(false);
  const [showShareConversation, setShowShareConversation] = useState(false);
  const [showSharedChats, setShowSharedChats] = useState(false);
  const [shareTargets, setShareTargets] = useState<ShareTargetUser[]>([]);
  const [receivedShares, setReceivedShares] = useState<ReceivedShare[]>([]);
  const [isLoadingShareTargets, setIsLoadingShareTargets] = useState(false);
  const [isLoadingReceivedShares, setIsLoadingReceivedShares] = useState(false);
  const [sharingToUserId, setSharingToUserId] = useState<string | null>(null);
  const [sharedWithIds, setSharedWithIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [messageToShare, setMessageToShare] = useState<Message | null>(null);
  const isMobile = useIsMobile();
  // Below lg there isn't room to dock side panels next to the message list
  const showSidePanelsAsSheets = !useIsDesktop();
  const [showConversationPanel, setShowConversationPanel] = useState(true);
  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/",
  );

  const unreadShareCount = receivedShares.filter((share) => !share.isRead)
    .length;
  const shouldShowMessagePanel = !isMobile && showConversationPanel;
  const isAdminRoute = currentPath === "/admin";

  const navigateTo = useCallback((path: string, replace = false) => {
    if (typeof window === "undefined") return;

    if (window.location.pathname !== path) {
      if (replace) {
        window.history.replaceState({}, "", path);
      } else {
        window.history.pushState({}, "", path);
      }
    }
    setCurrentPath(path);
  }, []);

  const loadShareTargets = async () => {
    setIsLoadingShareTargets(true);
    setShareError(null);
    try {
      const data = await apiClient<{ users: ShareTargetUser[] }>(
        "/conversations/share/users",
      );
      setShareTargets(data.users);
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : "Failed to load users",
      );
    } finally {
      setIsLoadingShareTargets(false);
    }
  };

  const loadReceivedShares = async () => {
    setIsLoadingReceivedShares(true);
    try {
      const data = await apiClient<{ shares: ReceivedShare[] }>(
        "/conversations/shared/received",
      );
      setReceivedShares(data.shares);
    } catch (error) {
      console.error("Failed to load shared chats:", error);
    } finally {
      setIsLoadingReceivedShares(false);
    }
  };

  useEffect(() => {
    void loadReceivedShares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (currentPath !== "/" && currentPath !== "/admin") {
      navigateTo("/", true);
    }
  }, [currentPath, navigateTo]);

  useEffect(() => {
    if (isAdminRoute && !isAdmin) {
      navigateTo("/", true);
    }
  }, [isAdminRoute, isAdmin, navigateTo]);

  const handleOpenShareConversation = async () => {
    if (!selectedConversation) return;
    setMessageToShare(null);
    setShowShareConversation(true);
    setShareMessage(null);
    setSharedWithIds(new Set());
    await loadShareTargets();
  };

  const handleOpenShareMessage = async (message: Message) => {
    setMessageToShare(message);
    setShowShareConversation(true);
    setShareMessage(null);
    setSharedWithIds(new Set());
    await loadShareTargets();
  };

  const handleShareConversation = async (
    targetUserId: string,
    targetUsername: string,
  ) => {
    if (!selectedConversation) return;

    setSharingToUserId(targetUserId);
    setShareError(null);
    try {
      await apiClient(`/conversations/${selectedConversation.id}/share`, {
        method: "POST",
        body: JSON.stringify({
          targetUserId,
          messageId: messageToShare?.id,
        }),
      });
      setSharedWithIds((prev) => new Set(prev).add(targetUserId));
      setShareMessage(
        messageToShare
          ? `Message shared with ${targetUsername}`
          : `Conversation shared with ${targetUsername}`,
      );
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : "Failed to share chat",
      );
    } finally {
      setSharingToUserId(null);
    }
  };

  const handleOpenSharedChats = async () => {
    setShowSharedChats(true);
    await loadReceivedShares();
  };

  const handleOpenSharedConversation = async (share: ReceivedShare) => {
    try {
      await apiClient(`/conversations/shared/${share.id}/open`, {
        method: "PUT",
      });
    } catch (error) {
      console.error("Failed to mark shared chat as opened:", error);
    }

    setReceivedShares((prev) =>
      prev.map((item) =>
        item.id === share.id
          ? { ...item, isRead: true, openedAt: new Date().toISOString() }
          : item,
      ),
    );

    if (share.messageId) {
      goToBookmark({
        messageId: share.messageId,
        conversationId: share.conversationId,
        content: share.messagePreview || "Shared message",
        from: share.sharedBy,
        date: new Date(share.messageDate || share.createdAt),
        createdAt: new Date(share.createdAt),
      });
    } else {
      selectConversation(share.conversationId);
    }
    if (isMobile) {
      setShowMobileMenu(false);
    }
    setShowSharedChats(false);
  };

  const shareSheets = (
    <>
      <Sheet
        open={showShareConversation}
        onOpenChange={setShowShareConversation}
      >
        <SheetContent side="right" className="flex w-full max-w-md flex-col">
          <SheetHeader className="pr-8 text-left">
            <SheetTitle>
              {messageToShare ? "Share message" : "Share conversation"}
            </SheetTitle>
            <SheetDescription>
              {messageToShare
                ? `From ${selectedConversation?.title ?? "this conversation"}. The recipient jumps straight to it.`
                : selectedConversation
                  ? `Give another user access to ${selectedConversation.title}.`
                  : "Select a conversation first."}
            </SheetDescription>
          </SheetHeader>

          {messageToShare && (
            <blockquote className="mt-4 rounded-lg border-l-4 border-primary/60 bg-muted/60 p-3 text-sm text-muted-foreground">
              <p className="line-clamp-3 [overflow-wrap:anywhere]">
                {messageToShare.content}
              </p>
            </blockquote>
          )}

          <div className="mt-4 min-h-0 flex-1 space-y-3">
            {shareError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {shareError}
              </div>
            )}
            {shareMessage && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success"
              >
                <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                {shareMessage}
              </div>
            )}

            {isLoadingShareTargets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : shareTargets.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                There are no other users to share with yet.
              </p>
            ) : (
              <ul className="max-h-[60dvh] space-y-1 overflow-y-auto pr-1">
                {shareTargets.map((target) => {
                  const isSharing = sharingToUserId === target.id;
                  const isShared = sharedWithIds.has(target.id);
                  return (
                    <li
                      key={target.id}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback
                            className={cn(
                              "text-xs font-semibold",
                              getAvatarColor(target.username),
                            )}
                          >
                            {getInitials(target.username)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-sm font-medium">
                          {target.username}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant={isShared ? "secondary" : "default"}
                        onClick={() =>
                          handleShareConversation(target.id, target.username)
                        }
                        disabled={isSharing || isShared}
                        aria-label={
                          isShared
                            ? `Shared with ${target.username}`
                            : `Share with ${target.username}`
                        }
                        className="min-w-[4.75rem]"
                      >
                        {isSharing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isShared ? (
                          <>
                            <Check className="h-4 w-4" />
                            Shared
                          </>
                        ) : (
                          "Share"
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showSharedChats} onOpenChange={setShowSharedChats}>
        <SheetContent side="right" className="flex w-full max-w-md flex-col">
          <SheetHeader className="pr-8 text-left">
            <SheetTitle>Shared with you</SheetTitle>
            <SheetDescription>
              Open a shared chat to jump directly to it.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 min-h-0 flex-1">
            {isLoadingReceivedShares ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : receivedShares.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
                  <Inbox aria-hidden="true" className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium">Nothing shared yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Conversations and messages others share with you appear here.
                </p>
              </div>
            ) : (
              <ul className="max-h-[70dvh] space-y-2 overflow-y-auto pr-1">
                {receivedShares.map((share) => (
                  <li key={share.id}>
                    <button
                      onClick={() => handleOpenSharedConversation(share)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        share.isRead
                          ? "border-border"
                          : "border-primary/30 bg-accent/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">
                          {share.conversationTitle}
                        </p>
                        {!share.isRead && (
                          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                            New
                          </span>
                        )}
                      </div>
                      {share.messagePreview && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                          “{share.messagePreview}”
                        </p>
                      )}
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {share.sharedType === "message" ? "Message" : "Conversation"}{" "}
                        shared by{" "}
                        <span className="font-medium text-foreground">
                          {share.sharedBy}
                        </span>{" "}
                        · {formatDate(new Date(share.createdAt))}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );

  // Close mobile menu when a conversation is selected
  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    if (isMobile) {
      setShowMobileMenu(false);
    }
  };

  if (isAdminRoute && isAdmin) {
    return <AdminDashboard onBack={() => navigateTo("/")} />;
  }

  if (isLoading) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <MessageSquare aria-hidden="true" className="h-6 w-6" />
        </div>
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your conversations…
        </div>
      </div>
    );
  }

  const hasConversations = conversations.length > 0;
  const onlineInRoom =
    currentRoom?.participants.filter((p) => p.isOnline).length || 0;

  const badge = (count: number) =>
    count > 0 && (
      <span
        aria-hidden="true"
        className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground ring-2 ring-card"
      >
        {count > 9 ? "9+" : count}
      </span>
    );

  const header = (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-2 sm:px-3 lg:gap-3 lg:px-4">
      {hasConversations && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (isMobile) {
              setShowMobileMenu(true);
              return;
            }
            setShowConversationPanel((prev) => !prev);
          }}
          className="shrink-0"
          aria-label={
            isMobile
              ? "Open conversations"
              : showConversationPanel
                ? "Hide conversations panel"
                : "Show conversations panel"
          }
          aria-expanded={isMobile ? showMobileMenu : showConversationPanel}
          title={
            isMobile
              ? "Open conversations"
              : showConversationPanel
                ? "Hide conversations panel"
                : "Show conversations panel"
          }
        >
          {isMobile || !showConversationPanel ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>
      )}

      <div className="flex shrink-0 items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <MessageSquare aria-hidden="true" className="h-4 w-4" />
        </div>
        <div className="hidden min-w-0 leading-tight sm:block">
          <h1 className="whitespace-nowrap text-sm font-semibold tracking-tight">
            LinkedIn Messages
          </h1>
          {hasConversations && (
            <p className="whitespace-nowrap text-xs text-muted-foreground">
              {conversations.length.toLocaleString()} conversations
            </p>
          )}
        </div>
      </div>

      {/* Desktop search */}
      <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
        {hasConversations && (
          <div className="w-full max-w-xl">
            <SearchBar />
          </div>
        )}
      </div>
      <div className="flex-1 md:hidden" />

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        {isMobile && hasConversations && (
          <Button
            variant={showMobileSearch ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setShowMobileSearch((prev) => !prev)}
            aria-label={showMobileSearch ? "Close search" : "Search messages"}
            aria-expanded={showMobileSearch}
          >
            {showMobileSearch ? (
              <X className="h-5 w-5" />
            ) : (
              <Search className="h-5 w-5" />
            )}
          </Button>
        )}

        {/* Read together */}
        {hasConversations &&
          (isInRoom ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showRoomPanel ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowRoomPanel((prev) => !prev)}
                  aria-label={`Room ${currentRoom?.code}, ${onlineInRoom} online. ${showRoomPanel ? "Hide" : "Show"} room panel`}
                  aria-pressed={showRoomPanel}
                  className="gap-1.5 px-2.5"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  <Users className="h-4 w-4" />
                  <span className="tabular-nums">{onlineInRoom}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Room {currentRoom?.code}</TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Read together">
                      <Users className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Read together</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                  Read together
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setShowCreateRoom(true)}
                  disabled={!selectedConversation}
                >
                  <Users className="h-4 w-4" />
                  <div>
                    <p>Start a room</p>
                    <p className="text-xs text-muted-foreground">
                      Read this conversation in sync
                    </p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowJoinRoom(true)}
                  disabled={!isConnected}
                >
                  <UserPlus className="h-4 w-4" />
                  <div>
                    <p>Join with a code</p>
                    {!isConnected && (
                      <p className="text-xs text-muted-foreground">
                        Connecting…
                      </p>
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowRoomManager(true)}>
                  <LayoutList className="h-4 w-4" />
                  Room manager
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ))}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenSharedChats}
              className="relative"
              aria-label={
                unreadShareCount > 0
                  ? `Shared with you, ${unreadShareCount} new`
                  : "Shared with you"
              }
            >
              <Inbox className="h-5 w-5" />
              {badge(unreadShareCount)}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Shared with you</TooltipContent>
        </Tooltip>

        {hasConversations && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showBookmarks ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setShowBookmarks((prev) => !prev)}
                className="relative"
                aria-label={`Bookmarks, ${bookmarks.length}`}
                aria-pressed={showBookmarks}
              >
                <Bookmark className="h-5 w-5" />
                {badge(bookmarks.length)}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bookmarks</TooltipContent>
          </Tooltip>
        )}

        {/* Account */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="ml-0.5 h-9 gap-2 rounded-full px-1 lg:pr-3"
              aria-label={`Account menu for ${user?.username ?? "user"}`}
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback
                  className={cn(
                    "text-xs font-semibold",
                    getAvatarColor(user?.username),
                  )}
                >
                  {getInitials(user?.username)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[8rem] truncate text-sm font-medium text-foreground lg:inline">
                {user?.username}
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 lg:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="truncate text-sm font-medium">{user?.username}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isAdmin && (
              <DropdownMenuItem onClick={() => navigateTo("/admin")}>
                <Settings className="h-4 w-4" />
                Admin dashboard
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
              <KeyRound className="h-4 w-4" />
              Change password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );

  if (!hasConversations) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        {header}
        <ChangePasswordModal
          isOpen={showChangePassword}
          onClose={() => setShowChangePassword(false)}
        />
        {shareSheets}
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="flex max-w-sm flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
              <MessagesSquare aria-hidden="true" className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold">No conversations yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? "Upload your LinkedIn messages export (messages.csv) to get started."
                : "Nothing has been shared with you yet. Ask an admin to import messages or share a conversation."}
            </p>
            {isAdmin && (
              <Button className="mt-5" onClick={() => navigateTo("/admin")}>
                <Upload className="h-4 w-4" /> Upload messages
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  const loadedCount = selectedConversation?.messages.length ?? 0;
  const totalCount = Math.max(totalMessageCount, loadedCount);
  const participantCount = selectedConversation?.participants.length ?? 0;

  const renderConversationHeader = (toolbar: React.ReactNode) =>
    selectedConversation && (
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/80 px-2 backdrop-blur-sm sm:px-3 lg:px-6">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMobileMenu(true)}
            className="shrink-0"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="hidden h-9 w-9 shrink-0 sm:flex">
          <AvatarFallback
            className={cn(
              "text-xs font-semibold",
              getAvatarColor(selectedConversation.title),
            )}
          >
            {getInitials(selectedConversation.title)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold sm:text-base">
            {selectedConversation.title}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {totalCount.toLocaleString()} messages · {participantCount}{" "}
            {participantCount === 1 ? "participant" : "participants"}
            {hasMoreMessages && (
              <span className="hidden sm:inline">
                {" "}
                · {loadedCount.toLocaleString()} loaded
              </span>
            )}
          </p>
        </div>
        {toolbar}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenShareConversation}
              aria-label="Share conversation"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden lg:inline">Share</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="lg:hidden">Share conversation</TooltipContent>
        </Tooltip>
      </div>
    );

  return (
    <div className="flex h-dvh flex-col bg-background">
      {header}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      {/* Room Modals */}
      <CreateRoomModal
        isOpen={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
        onCreated={() => setShowRoomPanel(true)}
      />
      <JoinRoomModal
        isOpen={showJoinRoom}
        onClose={() => setShowJoinRoom(false)}
        onJoined={() => setShowRoomPanel(true)}
      />
      <RoomManagerModal
        isOpen={showRoomManager}
        onClose={() => setShowRoomManager(false)}
      />
      {shareSheets}

      {/* Mobile search bar (expandable) */}
      {isMobile && showMobileSearch && (
        <div className="border-b border-border bg-card px-3 py-2">
          <SearchBar />
        </div>
      )}

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        {shouldShowMessagePanel && (
          <div className="w-72 shrink-0 lg:w-80">
            <ConversationList />
          </div>
        )}

        {/* Mobile drawer for conversations */}
        <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
          <SheetContent
            side="left"
            className="w-full max-w-xs p-0"
            // Don't pop the on-screen keyboard by focusing the filter input
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <SheetTitle className="sr-only">Conversations</SheetTitle>
            <SheetDescription className="sr-only">
              Choose a conversation to read
            </SheetDescription>
            <ConversationList onSelectConversation={handleSelectConversation} />
          </SheetContent>
        </Sheet>

        {/* Message list */}
        <main className="flex min-w-0 flex-1 flex-col">
          <MessageList
            onShareMessage={handleOpenShareMessage}
            renderHeader={renderConversationHeader}
            onBrowseConversations={
              isMobile ? () => setShowMobileMenu(true) : undefined
            }
          />
        </main>

        {/* Bookmark panel - docked on desktop, slide-over sheet on smaller screens */}
        {showSidePanelsAsSheets ? (
          <Sheet open={showBookmarks} onOpenChange={setShowBookmarks}>
            <SheetContent
              side="right"
              className="w-full max-w-xs p-0 [&>button:last-child]:hidden"
            >
              <SheetTitle className="sr-only">Bookmarks</SheetTitle>
              <SheetDescription className="sr-only">
                Your saved messages
              </SheetDescription>
              <BookmarkPanel
                isOpen={true}
                onClose={() => setShowBookmarks(false)}
              />
            </SheetContent>
          </Sheet>
        ) : (
          <BookmarkPanel
            isOpen={showBookmarks}
            onClose={() => setShowBookmarks(false)}
          />
        )}

        {/* Room panel - docked on desktop, slide-over sheet on smaller screens */}
        {showSidePanelsAsSheets ? (
          <Sheet
            open={showRoomPanel && isInRoom}
            onOpenChange={setShowRoomPanel}
          >
            <SheetContent
              side="right"
              className="w-full max-w-xs p-0 [&>button:last-child]:hidden"
            >
              <SheetTitle className="sr-only">Read Together Room</SheetTitle>
              <SheetDescription className="sr-only">
                Room participants and scroll control
              </SheetDescription>
              <RoomPanel
                isOpen={true}
                onClose={() => setShowRoomPanel(false)}
              />
            </SheetContent>
          </Sheet>
        ) : (
          isInRoom && (
            <RoomPanel
              isOpen={showRoomPanel}
              onClose={() => setShowRoomPanel(false)}
            />
          )
        )}
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <MessageProvider>
      <RoomProvider>
        <AppContent />
      </RoomProvider>
    </MessageProvider>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </TooltipProvider>
  );
}

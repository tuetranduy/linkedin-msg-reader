import { useCallback, useEffect, useState } from "react";
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
import { Sheet, SheetContent, SheetTitle } from "./components/ui/sheet";
import { useIsMobile } from "./hooks/useMediaQuery";
import {
  Bookmark,
  MessageSquare,
  Settings,
  LogOut,
  Loader2,
  Menu,
  ArrowLeft,
  Search,
  KeyRound,
  Users,
  UserPlus,
  LayoutList,
  Share2,
  Inbox,
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
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [messageToShare, setMessageToShare] = useState<Message | null>(null);
  const isMobile = useIsMobile();
  const [showConversationPanel, setShowConversationPanel] = useState(true);
  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/",
  );

  const sharedMessageCount = receivedShares.filter(
    (share) => share.sharedType === "message",
  ).length;
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
    await loadShareTargets();
  };

  const handleOpenShareMessage = async (message: Message) => {
    setMessageToShare(message);
    setShowShareConversation(true);
    setShareMessage(null);
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
        <SheetContent side="right" className="w-full max-w-md">
          <SheetTitle>
            {messageToShare ? "Share Message" : "Share Conversation"}
          </SheetTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {messageToShare
              ? `Share this message from ${selectedConversation?.title}.`
              : selectedConversation
                ? `Share ${selectedConversation.title} with another user.`
                : "Select a conversation first."}
          </p>

          {messageToShare && (
            <div className="mt-3 rounded border bg-muted/30 p-3 text-sm text-muted-foreground">
              <p className="line-clamp-3 wrap-break-word">
                {messageToShare.content}
              </p>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {shareError && (
              <div className="rounded bg-red-50 p-3 text-sm text-red-900">
                {shareError}
              </div>
            )}
            {shareMessage && (
              <div className="rounded bg-green-50 p-3 text-sm text-green-900">
                {shareMessage}
              </div>
            )}

            {isLoadingShareTargets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : shareTargets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No users available.
              </p>
            ) : (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {shareTargets.map((target) => (
                  <div
                    key={target.id}
                    className="flex items-center justify-between gap-3 rounded border p-3"
                  >
                    <span className="truncate text-sm font-medium">
                      {target.username}
                    </span>
                    <Button
                      size="sm"
                      onClick={() =>
                        handleShareConversation(target.id, target.username)
                      }
                      disabled={sharingToUserId === target.id}
                    >
                      {sharingToUserId === target.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Share"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showSharedChats} onOpenChange={setShowSharedChats}>
        <SheetContent side="right" className="w-full max-w-md">
          <SheetTitle>Shared Chats</SheetTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a shared chat to jump directly to that conversation.
          </p>

          <div className="mt-4">
            {isLoadingReceivedShares ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : receivedShares.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No shared chats yet.
              </p>
            ) : (
              <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                {receivedShares.map((share) => (
                  <button
                    key={share.id}
                    onClick={() => handleOpenSharedConversation(share)}
                    className="w-full rounded border p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">
                        {share.conversationTitle}
                      </p>
                      {!share.isRead && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Shared by {share.sharedBy}
                    </p>
                    {share.messagePreview && (
                      <p className="mt-1 line-clamp-2 wrap-break-word text-xs text-muted-foreground">
                        {share.messagePreview}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(share.createdAt).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
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
      <div className="flex h-screen flex-col bg-background">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">LinkedIn Message Viewer</h1>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">LinkedIn Message Viewer</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right px-2">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-medium">{user?.username}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenSharedChats}
              className="relative"
              title="Shared Chats"
            >
              <Inbox className="h-5 w-5" />
              {sharedMessageCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {sharedMessageCount > 9 ? "9+" : sharedMessageCount}
                </span>
              )}
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateTo("/admin")}
              >
                <Settings className="h-4 w-4 mr-1" /> Admin
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowChangePassword(true)}
              title="Change Password"
            >
              <KeyRound className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </Button>
          </div>
        </header>

        {/* Change Password Modal */}
        <ChangePasswordModal
          isOpen={showChangePassword}
          onClose={() => setShowChangePassword(false)}
        />
        {shareSheets}
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold mb-2">
              No conversations available
            </h2>
            {isAdmin && (
              <Button className="mt-4" onClick={() => navigateTo("/admin")}>
                <Settings className="h-4 w-4 mr-2" /> Open Admin Dashboard
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header - Responsive */}
      <header className="flex items-center justify-between border-b border-border px-3 py-3 lg:px-6">
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Conversation panel toggle */}
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
            title={
              isMobile
                ? "Open conversations"
                : showConversationPanel
                  ? "Collapse messages panel"
                  : "Expand messages panel"
            }
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="rounded-lg bg-primary p-1.5 lg:p-2">
            <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base lg:text-lg font-bold">
              LinkedIn Messages
            </h1>
            <p className="text-xs text-muted-foreground">
              {conversations.length} conversations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          {/* Desktop search bar */}
          <div className="hidden md:block w-64 lg:w-80">
            <SearchBar />
          </div>

          <div className="hidden lg:block text-right">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium">{user?.username}</p>
          </div>

          {/* Mobile search button */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileSearch(!showMobileSearch)}
            >
              <Search className="h-5 w-5" />
            </Button>
          )}

          {/* Room buttons */}
          {isInRoom ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setShowRoomPanel(!showRoomPanel)}
                  className="relative"
                >
                  <Users className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                    {currentRoom?.participants.filter((p) => p.isOnline)
                      .length || 0}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Room: {currentRoom?.code}</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowCreateRoom(true)}
                    disabled={!selectedConversation}
                  >
                    <Users className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Read Together</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowJoinRoom(true)}
                    disabled={!isConnected}
                  >
                    <UserPlus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Join Room</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowRoomManager(true)}
              >
                <LayoutList className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Room Manager</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenShareConversation}
                disabled={!selectedConversation}
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share Conversation</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenSharedChats}
                className="relative"
              >
                <Inbox className="h-5 w-5" />
                {sharedMessageCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {sharedMessageCount > 9 ? "9+" : sharedMessageCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Shared Chats</TooltipContent>
          </Tooltip>

          <Button
            variant={showBookmarks ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setShowBookmarks(!showBookmarks)}
            className="relative"
          >
            <Bookmark className="h-5 w-5" />
            {bookmarks.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {bookmarks.length > 9 ? "9+" : bookmarks.length}
              </span>
            )}
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateTo("/admin")}
              title="Admin"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowChangePassword(true)}
            title="Change Password"
          >
            <KeyRound className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="lg:hidden"
          >
            <LogOut className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="hidden lg:flex"
          >
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

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
        <div className="border-b border-border px-3 py-2">
          <SearchBar />
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        {shouldShowMessagePanel && (
          <div className="w-80 shrink-0">
            <ConversationList />
          </div>
        )}

        {/* Mobile drawer for conversations */}
        <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
          <SheetContent side="left" className="w-full max-w-xs p-0">
            <SheetTitle className="sr-only">Conversations</SheetTitle>
            <ConversationList onSelectConversation={handleSelectConversation} />
          </SheetContent>
        </Sheet>

        {/* Message list */}
        <div className="flex flex-1 flex-col">
          {selectedConversation && (
            <div className="border-b border-border px-3 py-2 lg:px-6 lg:py-3">
              <div className="flex items-center gap-2">
                {isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMobileMenu(true)}
                    className="shrink-0 -ml-1"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold truncate">
                    {selectedConversation.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.messages.length} messages -{" "}
                    {selectedConversation.participants.length} participants
                  </p>
                </div>
              </div>
            </div>
          )}
          <MessageList onShareMessage={handleOpenShareMessage} />
        </div>

        {/* Bookmark panel - Desktop sidebar or Mobile sheet */}
        {isMobile ? (
          <Sheet open={showBookmarks} onOpenChange={setShowBookmarks}>
            <SheetContent side="right" className="w-full max-w-xs p-0">
              <SheetTitle className="sr-only">Bookmarks</SheetTitle>
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

        {/* Room panel - Desktop sidebar or Mobile sheet */}
        {isMobile ? (
          <Sheet
            open={showRoomPanel && isInRoom}
            onOpenChange={setShowRoomPanel}
          >
            <SheetContent side="right" className="w-full max-w-xs p-0">
              <SheetTitle className="sr-only">Read Together Room</SheetTitle>
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

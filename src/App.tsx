import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { MessageProvider, useMessages } from "./context/MessageContext";
import { ConversationList } from "./components/ConversationList";
import { MessageList } from "./components/MessageList";
import { SearchBar } from "./components/SearchBar";
import { BookmarkPanel } from "./components/BookmarkPanel";
import { LoginForm } from "./components/auth/LoginForm";
import { ChangePasswordModal } from "./components/auth/ChangePasswordModal";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { Button } from "./components/ui/button";
import { TooltipProvider } from "./components/ui/tooltip";
import { Sheet, SheetContent, SheetTitle } from "./components/ui/sheet";
import { useIsMobile } from "./hooks/useMediaQuery";
import {
  Bookmark,
  Moon,
  Sun,
  MessageSquare,
  Settings,
  LogOut,
  Loader2,
  Menu,
  ArrowLeft,
  Search,
  KeyRound,
} from "lucide-react";

function AppContent() {
  const { isAdmin, logout } = useAuth();
  const {
    conversations,
    selectedConversation,
    bookmarks,
    isLoading,
    selectConversation,
  } = useMessages();
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const isMobile = useIsMobile();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Close mobile menu when a conversation is selected
  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    if (isMobile) {
      setShowMobileMenu(false);
    }
  };

  if (showAdmin && isAdmin) {
    return <AdminDashboard onBack={() => setShowAdmin(false)} />;
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
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdmin(true)}
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
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
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold mb-2">
              No conversations available
            </h2>
            {isAdmin && (
              <Button className="mt-4" onClick={() => setShowAdmin(true)}>
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
          {/* Mobile menu button */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileMenu(true)}
              className="shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
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
              onClick={() => setShowAdmin(true)}
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
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
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

      {/* Mobile search bar (expandable) */}
      {isMobile && showMobileSearch && (
        <div className="border-b border-border px-3 py-2">
          <SearchBar />
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        {!isMobile && (
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
          <MessageList />
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
      <AppContent />
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

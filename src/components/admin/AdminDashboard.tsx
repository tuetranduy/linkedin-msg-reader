import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { UserManagement } from "./UserManagement";
import { ConversationManager } from "./ConversationManager";
import { RoomManagerModal } from "@/components/RoomManagerModal";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/api/client";
import {
  Users,
  MessageSquare,
  Upload,
  LogOut,
  ArrowLeft,
  FileUp,
  CheckCircle,
  LayoutList,
} from "lucide-react";

interface AdminDashboardProps {
  onBack: () => void;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const { logout } = useAuth();
  const [tab, setTab] = useState<"upload" | "conversations" | "users">(
    "conversations",
  );
  const [uploadStatus, setUploadStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showRoomManager, setShowRoomManager] = useState(false);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setUploadStatus(null);

      try {
        const result = await uploadFile(file);
        setUploadStatus({
          success: true,
          message: `Uploaded ${result.conversationCount} conversations with ${result.messageCount} messages`,
        });
        // Switch to conversations tab after upload
        setTimeout(() => setTab("conversations"), 1500);
      } catch (err) {
        setUploadStatus({
          success: false,
          message: err instanceof Error ? err.message : "Upload failed",
        });
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    },
    [],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-3 lg:px-4 py-2 lg:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="px-2 lg:px-3"
            >
              <ArrowLeft className="h-4 w-4 lg:mr-1" />
              <span className="hidden sm:inline">Back to Messages</span>
            </Button>
            <h1 className="text-base lg:text-xl font-bold">Admin</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="px-2 lg:px-3"
          >
            <LogOut className="h-4 w-4 lg:mr-1" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-3 lg:px-4 py-4 lg:py-6">
        <div className="flex flex-wrap gap-2 mb-4 lg:mb-6">
          <Button
            variant="outline"
            onClick={() => setShowRoomManager(true)}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <LayoutList className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Room Manager</span>
          </Button>
          <Button
            variant={tab === "upload" ? "default" : "outline"}
            onClick={() => setTab("upload")}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <Upload className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Upload CSV</span>
          </Button>
          <Button
            variant={tab === "conversations" ? "default" : "outline"}
            onClick={() => setTab("conversations")}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <MessageSquare className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Conversations</span>
          </Button>
          <Button
            variant={tab === "users" ? "default" : "outline"}
            onClick={() => setTab("users")}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <Users className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Users</span>
          </Button>
        </div>

        <div className="bg-card rounded-lg border p-4 lg:p-6">
          {tab === "upload" && (
            <div className="space-y-4 lg:space-y-6">
              <div>
                <h2 className="text-lg lg:text-xl font-semibold mb-2">
                  Upload Messages CSV
                </h2>
                <p className="text-muted-foreground text-xs lg:text-sm">
                  Upload a LinkedIn messages export CSV file. This will replace
                  any existing messages.
                </p>
              </div>

              <div className="border-2 border-dashed rounded-lg p-6 lg:p-8 text-center">
                <FileUp className="h-10 w-10 lg:h-12 lg:w-12 mx-auto mb-3 lg:mb-4 text-muted-foreground" />
                <label className="cursor-pointer">
                  <span className="bg-primary text-primary-foreground px-3 lg:px-4 py-2 rounded-md hover:bg-primary/90 transition-colors text-sm">
                    {isUploading ? "Uploading..." : "Select CSV File"}
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
                <p className="text-xs lg:text-sm text-muted-foreground mt-3 lg:mt-4">
                  Supports LinkedIn message export format (messages.csv)
                </p>
              </div>

              {uploadStatus && (
                <div
                  className={`p-3 lg:p-4 rounded-lg flex items-center gap-2 lg:gap-3 text-sm ${
                    uploadStatus.success
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {uploadStatus.success && (
                    <CheckCircle className="h-4 w-4 lg:h-5 lg:w-5 shrink-0" />
                  )}
                  {uploadStatus.message}
                </div>
              )}
            </div>
          )}
          {tab === "conversations" && <ConversationManager />}
          {tab === "users" && <UserManagement />}
        </div>
      </div>

      <RoomManagerModal
        isOpen={showRoomManager}
        onClose={() => setShowRoomManager(false)}
      />
    </div>
  );
}

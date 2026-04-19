import { useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { UserManagement } from './UserManagement'
import { ConversationManager } from './ConversationManager'
import { Button } from '@/components/ui/button'
import { uploadFile } from '@/api/client'
import { Users, MessageSquare, Upload, LogOut, ArrowLeft, FileUp, CheckCircle } from 'lucide-react'

interface AdminDashboardProps {
  onBack: () => void
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const { logout } = useAuth()
  const [tab, setTab] = useState<'upload' | 'conversations' | 'users'>('conversations')
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadStatus(null)

    try {
      const result = await uploadFile(file)
      setUploadStatus({
        success: true,
        message: `Uploaded ${result.conversationCount} conversations with ${result.messageCount} messages`
      })
      // Switch to conversations tab after upload
      setTimeout(() => setTab('conversations'), 1500)
    } catch (err) {
      setUploadStatus({
        success: false,
        message: err instanceof Error ? err.message : 'Upload failed'
      })
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Messages
            </Button>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          <Button
            variant={tab === 'upload' ? 'default' : 'outline'}
            onClick={() => setTab('upload')}
          >
            <Upload className="h-4 w-4 mr-1" /> Upload CSV
          </Button>
          <Button
            variant={tab === 'conversations' ? 'default' : 'outline'}
            onClick={() => setTab('conversations')}
          >
            <MessageSquare className="h-4 w-4 mr-1" /> Conversations
          </Button>
          <Button
            variant={tab === 'users' ? 'default' : 'outline'}
            onClick={() => setTab('users')}
          >
            <Users className="h-4 w-4 mr-1" /> Users
          </Button>
        </div>

        <div className="bg-card rounded-lg border p-6">
          {tab === 'upload' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Upload Messages CSV</h2>
                <p className="text-muted-foreground text-sm">
                  Upload a LinkedIn messages export CSV file. This will replace any existing messages.
                </p>
              </div>

              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <label className="cursor-pointer">
                  <span className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
                    {isUploading ? 'Uploading...' : 'Select CSV File'}
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-muted-foreground mt-4">
                  Supports LinkedIn message export format (messages.csv)
                </p>
              </div>

              {uploadStatus && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${
                  uploadStatus.success 
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                  {uploadStatus.success && <CheckCircle className="h-5 w-5" />}
                  {uploadStatus.message}
                </div>
              )}
            </div>
          )}
          {tab === 'conversations' && <ConversationManager />}
          {tab === 'users' && <UserManagement />}
        </div>
      </div>
    </div>
  )
}

import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import bcrypt from 'bcrypt'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '../../data/linkedin-msg.db')
const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    participants TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    last_message_date DATETIME,
    is_visible INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    sender_profile_url TEXT,
    recipient TEXT,
    date DATETIME NOT NULL,
    subject TEXT,
    content TEXT,
    folder TEXT,
    attachments TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    content TEXT,
    sender TEXT,
    message_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, message_id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
  CREATE INDEX IF NOT EXISTS idx_messages_content ON messages(content);
`)

// Create default admin if no users exist
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
if (userCount.count === 0) {
    const passwordHash = bcrypt.hashSync('admin123', 12)
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', passwordHash, 'admin')
    console.log('Created default admin user: admin/admin123')
}

export default db

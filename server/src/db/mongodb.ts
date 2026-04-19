import { MongoClient, Db, ObjectId } from 'mongodb'
import bcrypt from 'bcrypt'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/linkedin-msg'

let client: MongoClient
let db: Db

export async function connectDB(): Promise<Db> {
    if (db) return db

    client = new MongoClient(MONGODB_URI)
    await client.connect()
    db = client.db()

    console.log('Connected to MongoDB')

    // Create indexes
    await db.collection('users').createIndex({ username: 1 }, { unique: true })
    await db.collection('messages').createIndex({ conversation_id: 1, date: 1 })
    await db.collection('messages').createIndex({ date: -1 })
    await db.collection('messages').createIndex({ content: 'text', from_name: 'text' })
    await db.collection('conversations').createIndex({ last_message_date: -1 })
    await db.collection('conversations').createIndex({ is_visible: 1, last_message_date: -1 })
    await db.collection('bookmarks').createIndex({ user_id: 1 })
    await db.collection('bookmarks').createIndex({ user_id: 1, message_id: 1 }, { unique: true })

    // Create default admin if not exists
    const adminExists = await db.collection('users').findOne({ username: 'admin' })
    if (!adminExists) {
        const passwordHash = bcrypt.hashSync('admin123', 12)
        await db.collection('users').insertOne({
            username: 'admin',
            password_hash: passwordHash,
            role: 'admin',
            created_at: new Date()
        })
        console.log('Created default admin user: admin/admin123')
    }

    return db
}

export function getDB(): Db {
    if (!db) {
        throw new Error('Database not connected. Call connectDB first.')
    }
    return db
}

export async function closeDB(): Promise<void> {
    if (client) {
        await client.close()
    }
}

export { ObjectId }

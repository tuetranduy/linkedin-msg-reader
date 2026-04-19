import { Router, Response } from 'express'
import multer from 'multer'
import Papa from 'papaparse'
import { getDB } from '../db/mongodb.js'
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.mongo.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

interface RawMessage {
    'CONVERSATION ID': string
    'CONVERSATION TITLE': string
    'FROM': string
    'SENDER PROFILE URL': string
    'TO': string
    'RECIPIENT PROFILE URLS': string
    'DATE': string
    'SUBJECT': string
    'CONTENT': string
    'FOLDER': string
    'ATTACHMENTS': string
}

router.post('/upload', authenticateToken, requireAdmin, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' })
        return
    }

    const csvContent = req.file.buffer.toString('utf-8')

    const parsed = Papa.parse<RawMessage>(csvContent, {
        header: true,
        skipEmptyLines: true
    })

    if (parsed.errors.length > 0) {
        console.warn('CSV parsing warnings:', parsed.errors)
    }

    const db = getDB()

    // Clear existing data
    await db.collection('bookmarks').deleteMany({})
    await db.collection('messages').deleteMany({})
    await db.collection('conversations').deleteMany({})

    // Group messages by conversation
    const conversationsMap = new Map<string, {
        title: string
        participants: Set<string>
        messages: RawMessage[]
        lastDate: Date
    }>()

    for (const raw of parsed.data) {
        const convId = raw['CONVERSATION ID']
        if (!convId) continue

        if (!conversationsMap.has(convId)) {
            conversationsMap.set(convId, {
                title: raw['CONVERSATION TITLE'] || 'Untitled',
                participants: new Set(),
                messages: [],
                lastDate: new Date(0)
            })
        }

        const conv = conversationsMap.get(convId)!
        conv.messages.push(raw)
        conv.participants.add(raw['FROM'])
        if (raw['TO']) conv.participants.add(raw['TO'])

        const msgDate = new Date(raw['DATE'])
        if (msgDate > conv.lastDate) {
            conv.lastDate = msgDate
        }
    }

    // Insert conversations
    const conversationDocs: Array<{ _id: unknown; title: string; participants: string[]; message_count: number; last_message_date: Date; is_visible: boolean }> = []
    for (const [convId, conv] of conversationsMap) {
        const participants = Array.from(conv.participants).filter(Boolean)
        // Use participant names if title is empty/Untitled
        const title = (conv.title && conv.title !== 'Untitled')
            ? conv.title
            : participants.slice(0, 2).join(' & ') || 'Untitled'
        
        conversationDocs.push({
            _id: convId as unknown,
            title,
            participants,
            message_count: conv.messages.length,
            last_message_date: conv.lastDate,
            is_visible: false
        })
    }

    if (conversationDocs.length > 0) {
        await db.collection('conversations').insertMany(conversationDocs as any)
    }

    // Insert messages
    let globalMsgIndex = 0
    const messageDocs = []

    for (const [convId, conv] of conversationsMap) {
        for (const msg of conv.messages) {
            const msgId = `msg-${convId.slice(0, 8)}-${globalMsgIndex++}`
            const attachments = msg['ATTACHMENTS']
                ? msg['ATTACHMENTS'].split(',').map(a => a.trim()).filter(Boolean)
                : []

            messageDocs.push({
                _id: msgId,
                conversation_id: convId,
                from_name: msg['FROM'],
                sender_profile_url: msg['SENDER PROFILE URL'],
                to_name: msg['TO'],
                date: new Date(msg['DATE']),
                subject: msg['SUBJECT'],
                content: msg['CONTENT'],
                folder: msg['FOLDER'],
                attachments
            })
        }
    }

    if (messageDocs.length > 0) {
        await db.collection('messages').insertMany(messageDocs as any)
    }

    res.json({ conversationCount: conversationsMap.size, messageCount: parsed.data.length })
})

export default router

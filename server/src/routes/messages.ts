import { Router, Response } from 'express'
import multer from 'multer'
import Papa from 'papaparse'
import db from '../db/database.js'
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js'

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

router.post('/upload', authenticateToken, requireAdmin, upload.single('file'), (req: AuthRequest, res: Response): void => {
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

    // Clear existing data in a transaction
    const clearAndInsert = db.transaction(() => {
        db.prepare('DELETE FROM bookmarks').run()
        db.prepare('DELETE FROM messages').run()
        db.prepare('DELETE FROM conversations').run()

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

        const insertConv = db.prepare(`
      INSERT INTO conversations (id, title, participants, message_count, last_message_date, is_visible)
      VALUES (?, ?, ?, ?, ?, 0)
    `)

        const insertMsg = db.prepare(`
      INSERT INTO messages (id, conversation_id, from_name, sender_profile_url, to_name, date, subject, content, folder, attachments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

        let globalMsgIndex = 0

        for (const [convId, conv] of conversationsMap) {
            insertConv.run(
                convId,
                conv.title,
                JSON.stringify(Array.from(conv.participants)),
                conv.messages.length,
                conv.lastDate.toISOString()
            )

            for (const msg of conv.messages) {
                const msgId = `msg-${convId.slice(0, 8)}-${globalMsgIndex++}`
                const attachments = msg['ATTACHMENTS']
                    ? msg['ATTACHMENTS'].split(',').map(a => a.trim()).filter(Boolean)
                    : []

                insertMsg.run(
                    msgId,
                    convId,
                    msg['FROM'],
                    msg['SENDER PROFILE URL'],
                    msg['TO'],
                    msg['DATE'],
                    msg['SUBJECT'],
                    msg['CONTENT'],
                    msg['FOLDER'],
                    JSON.stringify(attachments)
                )
            }
        }

        return { conversationCount: conversationsMap.size, messageCount: parsed.data.length }
    })

    const result = clearAndInsert()
    res.json(result)
})

export default router

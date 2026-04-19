import { Router, Response } from 'express'
import db from '../db/database.js'
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js'

const router = Router()

router.use(authenticateToken)

interface ConversationRow {
    id: string
    title: string
    participants: string
    message_count: number
    last_message_date: string
    is_visible: number
}

interface MessageRow {
    id: string
    conversation_id: string
    from_name: string
    sender_profile_url: string
    to_name: string
    date: string
    subject: string
    content: string
    folder: string
    attachments: string
}

router.get('/', (req: AuthRequest, res: Response): void => {
    const isAdmin = req.user?.role === 'admin'

    const query = isAdmin
        ? 'SELECT * FROM conversations ORDER BY last_message_date DESC'
        : 'SELECT * FROM conversations WHERE is_visible = 1 ORDER BY last_message_date DESC'

    const conversations = db.prepare(query).all() as ConversationRow[]

    res.json({
        conversations: conversations.map((c) => ({
            id: c.id,
            title: c.title,
            participants: JSON.parse(c.participants || '[]'),
            message_count: c.message_count,
            last_message_date: c.last_message_date,
            isVisible: Boolean(c.is_visible)
        }))
    })
})

router.get('/:id', (req: AuthRequest, res: Response): void => {
    const { id } = req.params
    const isAdmin = req.user?.role === 'admin'

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow | undefined

    if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' })
        return
    }

    if (!isAdmin && !conversation.is_visible) {
        res.status(403).json({ error: 'Access denied' })
        return
    }

    const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY date ASC').all(id) as MessageRow[]

    res.json({
        conversation: {
            id: conversation.id,
            title: conversation.title,
            participants: JSON.parse(conversation.participants || '[]'),
            message_count: conversation.message_count,
            last_message_date: conversation.last_message_date,
            isVisible: Boolean(conversation.is_visible)
        },
        messages: messages.map((m) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            from_name: m.from_name,
            to_name: m.to_name,
            date: m.date,
            content: m.content,
            folder: m.folder,
            attachments: m.attachments ? JSON.parse(m.attachments) : [],
            isCurrentUser: (m.sender_profile_url || '').toLowerCase().includes('tuetranduy')
        }))
    })
})

router.put('/:id/visibility', requireAdmin, (req: AuthRequest, res: Response): void => {
    const { id } = req.params
    const { isVisible } = req.body

    const result = db.prepare('UPDATE conversations SET is_visible = ? WHERE id = ?').run(isVisible ? 1 : 0, id)

    if (result.changes === 0) {
        res.status(404).json({ error: 'Conversation not found' })
        return
    }

    res.json({ success: true })
})

export default router

import { Router, Response } from 'express'
import db from '../db/database.js'
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js'

const router = Router()

router.use(authenticateToken)

router.get('/', (req: AuthRequest, res: Response): void => {
    const isAdmin = req.user?.role === 'admin'

    let conversations
    if (isAdmin) {
        conversations = db.prepare(`
      SELECT id, title, participants, message_count, last_message_date, is_visible
      FROM conversations
      ORDER BY last_message_date DESC
    `).all()
    } else {
        conversations = db.prepare(`
      SELECT id, title, participants, message_count, last_message_date, is_visible
      FROM conversations
      WHERE is_visible = 1
      ORDER BY last_message_date DESC
    `).all()
    }

    res.json({
        conversations: conversations.map((c: Record<string, unknown>) => ({
            ...c,
            participants: JSON.parse(c.participants as string),
            isVisible: Boolean(c.is_visible)
        }))
    })
})

router.get('/:id', (req: AuthRequest, res: Response): void => {
    const { id } = req.params
    const isAdmin = req.user?.role === 'admin'

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Record<string, unknown> | undefined

    if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' })
        return
    }

    if (!isAdmin && !conversation.is_visible) {
        res.status(403).json({ error: 'Access denied' })
        return
    }

    const messages = db.prepare(`
    SELECT * FROM messages WHERE conversation_id = ? ORDER BY date ASC
  `).all(id)

    res.json({
        conversation: {
            ...conversation,
            participants: JSON.parse(conversation.participants as string),
            isVisible: Boolean(conversation.is_visible)
        },
        messages: messages.map((m: Record<string, unknown>) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            from_name: m.sender,
            to_name: m.recipient,
            date: m.date,
            content: m.content,
            folder: m.folder,
            attachments: m.attachments ? JSON.parse(m.attachments as string) : [],
            isCurrentUser: (m.sender_profile_url as string || '').toLowerCase().includes('tuetranduy')
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

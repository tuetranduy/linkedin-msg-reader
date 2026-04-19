import { Router, Response } from 'express'
import db from '../db/database.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'

const router = Router()

router.use(authenticateToken)

router.get('/', (req: AuthRequest, res: Response): void => {
    const bookmarks = db.prepare(`
    SELECT b.id, b.message_id, b.conversation_id, b.content, b.sender, b.message_date, b.created_at,
           c.title as conversation_title
    FROM bookmarks b
    LEFT JOIN conversations c ON b.conversation_id = c.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `).all(req.user!.id)

    res.json({ bookmarks })
})

router.post('/', (req: AuthRequest, res: Response): void => {
    const { messageId, conversationId, content, from, date } = req.body

    if (!messageId || !conversationId) {
        res.status(400).json({ error: 'messageId and conversationId required' })
        return
    }

    try {
        const result = db.prepare(`
      INSERT INTO bookmarks (user_id, message_id, conversation_id, content, sender, message_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user!.id, messageId, conversationId, (content || '').slice(0, 200), from, date)

        res.json({
            bookmark: {
                id: result.lastInsertRowid,
                messageId,
                conversationId,
                content: (content || '').slice(0, 200),
                from,
                date
            }
        })
    } catch (err: unknown) {
        if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
            res.status(400).json({ error: 'Already bookmarked' })
            return
        }
        throw err
    }
})

router.delete('/:messageId', (req: AuthRequest, res: Response): void => {
    const { messageId } = req.params

    const result = db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND message_id = ?').run(req.user!.id, messageId)

    if (result.changes === 0) {
        res.status(404).json({ error: 'Bookmark not found' })
        return
    }

    res.json({ success: true })
})

export default router

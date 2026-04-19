import { Router, Response } from 'express'
import db from '../db/database.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticateToken, (req: AuthRequest, res: Response): void => {
    const query = req.query.q as string
    const isAdmin = req.user?.role === 'admin'

    if (!query || query.length < 2) {
        res.json({ results: [] })
        return
    }

    const searchPattern = `%${query}%`

    let results
    if (isAdmin) {
        results = db.prepare(`
      SELECT m.id, m.conversation_id, m.content, m.sender, m.date, c.title as conversation_title
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.content LIKE ?
      ORDER BY m.date DESC
      LIMIT 100
    `).all(searchPattern)
    } else {
        results = db.prepare(`
      SELECT m.id, m.conversation_id, m.content, m.sender, m.date, c.title as conversation_title
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.is_visible = 1 AND m.content LIKE ?
      ORDER BY m.date DESC
      LIMIT 100
    `).all(searchPattern)
    }

    res.json({ results })
})

export default router

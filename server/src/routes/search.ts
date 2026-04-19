import { Router, Response } from 'express'
import db from '../db/database.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'

const router = Router()

interface SearchResult {
    id: string
    conversation_id: string
    content: string
    from_name: string
    date: string
    conversation_title: string
}

router.get('/', authenticateToken, (req: AuthRequest, res: Response): void => {
    const query = req.query.q as string
    const isAdmin = req.user?.role === 'admin'

    if (!query || query.length < 2) {
        res.json({ results: [] })
        return
    }

    const searchPattern = `%${query}%`

    let results: SearchResult[]
    if (isAdmin) {
        results = db.prepare(`
      SELECT m.id, m.conversation_id, m.content, m.from_name, m.date, c.title as conversation_title
      FROM messages m
      LEFT JOIN conversations c ON m.conversation_id = c.id
      WHERE m.content LIKE ? OR m.from_name LIKE ?
      ORDER BY m.date DESC
      LIMIT 100
    `).all(searchPattern, searchPattern) as SearchResult[]
    } else {
        results = db.prepare(`
      SELECT m.id, m.conversation_id, m.content, m.from_name, m.date, c.title as conversation_title
      FROM messages m
      LEFT JOIN conversations c ON m.conversation_id = c.id
      WHERE c.is_visible = 1 AND (m.content LIKE ? OR m.from_name LIKE ?)
      ORDER BY m.date DESC
      LIMIT 100
    `).all(searchPattern, searchPattern) as SearchResult[]
    }

    res.json({
        results: results.map(m => ({
            id: m.id,
            conversation_id: m.conversation_id,
            content: m.content,
            sender: m.from_name,
            date: m.date,
            conversation_title: m.conversation_title
        }))
    })
})

export default router

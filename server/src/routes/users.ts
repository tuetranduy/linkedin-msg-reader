import { Router, Response } from 'express'
import bcrypt from 'bcrypt'
import db from '../db/database.js'
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js'

const router = Router()

router.use(authenticateToken, requireAdmin)

router.get('/', (_req: AuthRequest, res: Response): void => {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC').all()
    res.json({ users })
})

router.post('/', (req: AuthRequest, res: Response): void => {
    const { username, password, role } = req.body

    if (!username || !password) {
        res.status(400).json({ error: 'Username and password required' })
        return
    }

    if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' })
        return
    }

    try {
        const passwordHash = bcrypt.hashSync(password, 12)
        const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(
            username,
            passwordHash,
            role || 'user'
        )
        res.json({ user: { id: result.lastInsertRowid, username, role: role || 'user' } })
    } catch (err: unknown) {
        if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
            res.status(400).json({ error: 'Username already exists' })
            return
        }
        throw err
    }
})

router.put('/:id', (req: AuthRequest, res: Response): void => {
    const { id } = req.params
    const { username, password, role } = req.body

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id)
    if (!user) {
        res.status(404).json({ error: 'User not found' })
        return
    }

    if (username) {
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, id)
    }
    if (password) {
        const passwordHash = bcrypt.hashSync(password, 12)
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id)
    }
    if (role && ['admin', 'user'].includes(role)) {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
    }

    const updated = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id)
    res.json({ user: updated })
})

router.delete('/:id', (req: AuthRequest, res: Response): void => {
    const { id } = req.params

    // Prevent deleting self
    if (req.user?.id === parseInt(id)) {
        res.status(400).json({ error: 'Cannot delete your own account' })
        return
    }

    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)
    if (result.changes === 0) {
        res.status(404).json({ error: 'User not found' })
        return
    }

    res.json({ success: true })
})

export default router

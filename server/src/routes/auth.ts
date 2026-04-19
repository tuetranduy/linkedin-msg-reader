import { Router, Response } from 'express'
import bcrypt from 'bcrypt'
import db from '../db/database.js'
import { authenticateToken, requireAdmin, generateToken, AuthRequest } from '../middleware/auth.js'

const router = Router()

router.post('/login', (req: AuthRequest, res: Response): void => {
  const { username, password } = req.body

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' })
    return
  }

  const user = db.prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?').get(username) as {
    id: number
    username: string
    password_hash: string
    role: string
  } | undefined

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = generateToken(user.id)
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role }
  })
})

router.post('/register', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { username, password, role } = req.body

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  if (role && !['admin', 'user'].includes(role)) {
    res.status(400).json({ error: 'Role must be admin or user' })
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

router.get('/me', authenticateToken, (req: AuthRequest, res: Response): void => {
  res.json(req.user)
})

export default router

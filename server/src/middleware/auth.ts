import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import db from '../db/database.js'

const JWT_SECRET = process.env.JWT_SECRET || 'linkedin-msg-secret-key-change-in-production'

export interface AuthUser {
  id: number
  username: string
  role: 'admin' | 'user'
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number }
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(decoded.userId) as AuthUser | undefined
    
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }
    
    req.user = user
    next()
  } catch {
    res.status(403).json({ error: 'Invalid token' })
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' })
}

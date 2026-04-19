import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getDB, ObjectId } from '../db/mongodb.js'

const JWT_SECRET = process.env.JWT_SECRET || 'linkedin-msg-secret-key-change-in-production'

export interface AuthUser {
    id: string
    username: string
    role: 'admin' | 'user'
}

export interface AuthRequest extends Request {
    user?: AuthUser
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
        res.status(401).json({ error: 'Authentication required' })
        return
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
        const db = getDB()
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(decoded.userId) },
            { projection: { _id: 1, username: 1, role: 1 } }
        )

        if (!user) {
            res.status(401).json({ error: 'User not found' })
            return
        }

        req.user = {
            id: user._id.toString(),
            username: user.username,
            role: user.role
        }
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

export function generateToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' })
}

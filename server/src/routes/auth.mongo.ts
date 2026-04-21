import { Router, Response } from 'express'
import bcrypt from 'bcrypt'
import { getDB, ObjectId } from '../db/mongodb.js'
import { authenticateToken, requireAdmin, generateToken, AuthRequest } from '../middleware/auth.mongo.js'

const router = Router()

function getUserPasswordHash(user: { password_hash?: string; passwordHash?: string }): string | null {
    return user.password_hash || user.passwordHash || null
}

router.post('/login', async (req: AuthRequest, res: Response): Promise<void> => {
    const { username, password } = req.body

    if (!username || !password) {
        res.status(400).json({ error: 'Username and password required' })
        return
    }

    const db = getDB()
    const user = await db.collection('users').findOne({ username })

    const storedHash = user ? getUserPasswordHash(user as { password_hash?: string; passwordHash?: string }) : null
    if (!user || !storedHash) {
        res.status(401).json({ error: 'Invalid credentials' })
        return
    }

    const passwordValid = (() => {
        try {
            return bcrypt.compareSync(password, storedHash)
        } catch {
            return false
        }
    })()

    if (!passwordValid) {
        res.status(401).json({ error: 'Invalid credentials' })
        return
    }

    const token = generateToken(user._id.toString())
    res.json({
        token,
        user: { id: user._id.toString(), username: user.username, role: user.role }
    })
})

router.post('/register', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
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
        const db = getDB()
        const passwordHash = bcrypt.hashSync(password, 12)
        const result = await db.collection('users').insertOne({
            username,
            passwordHash,
            password_hash: passwordHash,
            role: role || 'user',
            created_at: new Date()
        })
        res.json({ user: { id: result.insertedId.toString(), username, role: role || 'user' } })
    } catch (err: unknown) {
        if ((err as { code?: number }).code === 11000) {
            res.status(400).json({ error: 'Username already exists' })
            return
        }
        throw err
    }
})

router.get('/me', authenticateToken, (req: AuthRequest, res: Response): void => {
    res.json(req.user)
})

router.put('/password', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Current password and new password required' })
        return
    }

    if (newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters' })
        return
    }

    const db = getDB()
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user?.id) })

    if (!user) {
        res.status(404).json({ error: 'User not found' })
        return
    }

    const storedHash = getUserPasswordHash(user as { password_hash?: string; passwordHash?: string })
    if (!storedHash) {
        res.status(401).json({ error: 'Current password is incorrect' })
        return
    }

    let currentPasswordValid = false
    try {
        currentPasswordValid = bcrypt.compareSync(currentPassword, storedHash)
    } catch {
        currentPasswordValid = false
    }

    if (!currentPasswordValid) {
        res.status(401).json({ error: 'Current password is incorrect' })
        return
    }

    const newPasswordHash = bcrypt.hashSync(newPassword, 12)
    await db.collection('users').updateOne(
        { _id: new ObjectId(user._id) },
        { $set: { passwordHash: newPasswordHash, password_hash: newPasswordHash } }
    )

    res.json({ success: true })
})

export default router

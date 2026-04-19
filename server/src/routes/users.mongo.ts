import { Router, Response } from 'express'
import bcrypt from 'bcrypt'
import { getDB, ObjectId } from '../db/mongodb.js'
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.mongo.js'

const router = Router()

router.use(authenticateToken, requireAdmin)

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
    const db = getDB()
    const users = await db.collection('users')
        .find({}, { projection: { password_hash: 0 } })
        .sort({ created_at: -1 })
        .toArray()

    res.json({
        users: users.map(u => ({
            id: u._id.toString(),
            username: u.username,
            role: u.role,
            created_at: u.created_at
        }))
    })
})

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
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
        const db = getDB()
        const passwordHash = bcrypt.hashSync(password, 12)
        const result = await db.collection('users').insertOne({
            username,
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

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { username, password, role } = req.body

    const db = getDB()

    let objectId: ObjectId
    try {
        objectId = new ObjectId(id as string)
    } catch {
        res.status(400).json({ error: 'Invalid user ID' })
        return
    }

    const user = await db.collection('users').findOne({ _id: objectId })
    if (!user) {
        res.status(404).json({ error: 'User not found' })
        return
    }

    const updates: Record<string, unknown> = {}

    if (username) {
        updates.username = username
    }
    if (password) {
        updates.password_hash = bcrypt.hashSync(password, 12)
    }
    if (role && ['admin', 'user'].includes(role)) {
        updates.role = role
    }

    if (Object.keys(updates).length > 0) {
        await db.collection('users').updateOne({ _id: objectId }, { $set: updates })
    }

    const updated = await db.collection('users').findOne(
        { _id: objectId },
        { projection: { password_hash: 0 } }
    )

    res.json({
        user: {
            id: updated?._id.toString(),
            username: updated?.username,
            role: updated?.role
        }
    })
})

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params

    // Prevent deleting self
    if (req.user?.id === id) {
        res.status(400).json({ error: 'Cannot delete your own account' })
        return
    }

    const db = getDB()

    let objectId: ObjectId
    try {
        objectId = new ObjectId(id as string)
    } catch {
        res.status(400).json({ error: 'Invalid user ID' })
        return
    }

    const result = await db.collection('users').deleteOne({ _id: objectId })

    if (result.deletedCount === 0) {
        res.status(404).json({ error: 'User not found' })
        return
    }

    res.json({ success: true })
})

export default router

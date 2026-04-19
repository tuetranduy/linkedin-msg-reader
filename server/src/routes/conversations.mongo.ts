import { Router, Response } from 'express'
import { getDB, ObjectId } from '../db/mongodb.js'
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.mongo.js'

const router = Router()

router.use(authenticateToken)

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
    const isAdmin = req.user?.role === 'admin'
    const db = getDB()

    const filter = isAdmin ? {} : { is_visible: true }
    const conversations = await db.collection('conversations')
        .find(filter, { projection: { _id: 1, title: 1, participants: 1, message_count: 1, last_message_date: 1, is_visible: 1 } })
        .sort({ last_message_date: -1 })
        .toArray()

    res.json({
        conversations: conversations.map((c) => ({
            id: c._id,
            title: c.title,
            participants: c.participants || [],
            message_count: c.message_count,
            last_message_date: c.last_message_date,
            isVisible: Boolean(c.is_visible)
        }))
    })
})

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { limit = '50', before, after } = req.query
    const isAdmin = req.user?.role === 'admin'
    const db = getDB()

    const conversation = await db.collection('conversations').findOne({ _id: id as unknown as ObjectId })

    if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' })
        return
    }

    if (!isAdmin && !conversation.is_visible) {
        res.status(403).json({ error: 'Access denied' })
        return
    }

    const messageLimit = Math.min(parseInt(limit as string) || 50, 200)

    // Build query for pagination
    const messageQuery: Record<string, unknown> = { conversation_id: id }
    let sortDirection: 1 | -1 = -1 // Default: newest first for initial load

    if (before) {
        // Load older messages (before this date)
        messageQuery.date = { $lt: new Date(before as string) }
        sortDirection = -1
    } else if (after) {
        // Load newer messages (after this date)
        messageQuery.date = { $gt: new Date(after as string) }
        sortDirection = 1
    }

    const messages = await db.collection('messages')
        .find(
            messageQuery,
            { projection: { _id: 1, conversation_id: 1, from_name: 1, to_name: 1, date: 1, content: 1, folder: 1, attachments: 1, sender_profile_url: 1 } }
        )
        .sort({ date: sortDirection })
        .limit(messageLimit)
        .toArray()

    // Reverse if we fetched in descending order so messages are chronological
    if (sortDirection === -1) {
        messages.reverse()
    }

    const hasMore = messages.length === messageLimit

    res.json({
        conversation: {
            id: conversation._id,
            title: conversation.title,
            participants: conversation.participants || [],
            message_count: conversation.message_count,
            last_message_date: conversation.last_message_date,
            isVisible: Boolean(conversation.is_visible)
        },
        messages: messages.map((m) => ({
            id: m._id,
            conversation_id: m.conversation_id,
            from_name: m.from_name,
            to_name: m.to_name,
            date: m.date,
            content: m.content,
            folder: m.folder,
            attachments: m.attachments || [],
            isCurrentUser: (m.sender_profile_url || '').toLowerCase().includes('tuetranduy')
        })),
        hasMore,
        totalCount: conversation.message_count
    })
})

router.put('/:id/visibility', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { isVisible } = req.body

    const db = getDB()
    const result = await db.collection('conversations').updateOne(
        { _id: id as unknown as ObjectId },
        { $set: { is_visible: Boolean(isVisible) } }
    )

    if (result.matchedCount === 0) {
        res.status(404).json({ error: 'Conversation not found' })
        return
    }

    res.json({ success: true })
})

export default router

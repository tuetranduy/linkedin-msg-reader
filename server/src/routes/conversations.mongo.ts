import { Router, Response } from 'express'
import { getDB, ObjectId } from '../db/mongodb.js'
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.mongo.js'

const router = Router()

router.use(authenticateToken)

async function isConversationSharedWithUser(conversationId: string, userId: string): Promise<boolean> {
    const db = getDB()
    const shared = await db.collection('shared_chats').findOne(
        { conversation_id: conversationId, to_user_id: userId },
        { projection: { _id: 1 } }
    )
    return Boolean(shared)
}

function toParamString(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
        return value[0] || ''
    }
    return value || ''
}

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
    const isAdmin = req.user?.role === 'admin'
    const db = getDB()

    let filter: Record<string, unknown> = {}
    if (!isAdmin) {
        const sharedConversationIds = await db.collection('shared_chats').distinct('conversation_id', {
            to_user_id: req.user?.id
        }) as string[]

        filter = sharedConversationIds.length > 0
            ? { $or: [{ is_visible: true }, { _id: { $in: sharedConversationIds } }] }
            : { is_visible: true }
    }

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

router.get('/share/users', async (req: AuthRequest, res: Response): Promise<void> => {
    const db = getDB()
    const users = await db.collection('users')
        .find(
            { username: { $ne: req.user?.username } },
            { projection: { _id: 1, username: 1 } }
        )
        .sort({ username: 1 })
        .toArray()

    res.json({
        users: users.map((u) => ({
            id: u._id.toString(),
            username: u.username
        }))
    })
})

router.get('/shared/received', async (req: AuthRequest, res: Response): Promise<void> => {
    const db = getDB()
    const shares = await db.collection('shared_chats')
        .find({ to_user_id: req.user?.id })
        .sort({ created_at: -1 })
        .limit(100)
        .toArray()

    const conversationIds = Array.from(new Set(shares.map((s) => s.conversation_id).filter(Boolean)))
    const senderIds = Array.from(new Set(shares.map((s) => s.from_user_id).filter(Boolean)))

    const senderObjectIds = senderIds.flatMap((senderId) => {
        try {
            return [new ObjectId(senderId as string)]
        } catch {
            return []
        }
    })

    const [conversations, senders] = await Promise.all([
        conversationIds.length > 0
            ? db.collection('conversations')
                .find({ _id: { $in: conversationIds } }, { projection: { _id: 1, title: 1 } })
                .toArray()
            : Promise.resolve([]),
        senderObjectIds.length > 0
            ? db.collection('users')
                .find({ _id: { $in: senderObjectIds } }, { projection: { _id: 1, username: 1 } })
                .toArray()
            : Promise.resolve([])
    ])

    const conversationMap = new Map(conversations.map((c) => [String(c._id), c.title]))
    const senderMap = new Map(senders.map((u) => [u._id.toString(), u.username]))

    res.json({
        shares: shares
            .filter((s) => conversationMap.has(s.conversation_id))
            .map((s) => ({
                id: s._id.toString(),
                conversationId: s.conversation_id,
                conversationTitle: conversationMap.get(s.conversation_id),
                sharedBy: senderMap.get(s.from_user_id) || 'Unknown',
                createdAt: s.created_at,
                openedAt: s.opened_at || null,
                isRead: Boolean(s.opened_at)
            }))
    })
})

router.put('/shared/:shareId/open', async (req: AuthRequest, res: Response): Promise<void> => {
    const shareId = toParamString(req.params.shareId)
    const db = getDB()

    let shareObjectId: ObjectId
    try {
        shareObjectId = new ObjectId(shareId)
    } catch {
        res.status(400).json({ error: 'Invalid shared chat ID' })
        return
    }

    const result = await db.collection('shared_chats').updateOne(
        { _id: shareObjectId, to_user_id: req.user?.id, opened_at: { $exists: false } },
        { $set: { opened_at: new Date() } }
    )

    if (result.matchedCount === 0) {
        await db.collection('shared_chats').updateOne(
            { _id: shareObjectId, to_user_id: req.user?.id, opened_at: null },
            { $set: { opened_at: new Date() } }
        )
    }

    res.json({ success: true })
})

router.post('/:id/share', async (req: AuthRequest, res: Response): Promise<void> => {
    const id = toParamString(req.params.id)
    const { targetUserId } = req.body

    if (!targetUserId || typeof targetUserId !== 'string') {
        res.status(400).json({ error: 'Target user is required' })
        return
    }

    if (targetUserId === req.user?.id) {
        res.status(400).json({ error: 'Cannot share with yourself' })
        return
    }

    const db = getDB()
    const conversation = await db.collection('conversations').findOne({ _id: id as unknown as ObjectId })

    if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' })
        return
    }

    const isAdmin = req.user?.role === 'admin'
    const hasAccess = isAdmin || Boolean(conversation.is_visible) || await isConversationSharedWithUser(id, req.user?.id || '')
    if (!hasAccess) {
        res.status(403).json({ error: 'Access denied' })
        return
    }

    let targetObjectId: ObjectId
    try {
        targetObjectId = new ObjectId(targetUserId)
    } catch {
        res.status(400).json({ error: 'Invalid target user' })
        return
    }

    const targetUser = await db.collection('users').findOne(
        { _id: targetObjectId },
        { projection: { _id: 1 } }
    )

    if (!targetUser) {
        res.status(404).json({ error: 'Target user not found' })
        return
    }

    await db.collection('shared_chats').insertOne({
        conversation_id: id,
        from_user_id: req.user?.id,
        to_user_id: targetUserId,
        created_at: new Date(),
        opened_at: null
    })

    res.json({ success: true })
})

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    const id = toParamString(req.params.id)
    const { limit = '50', before, after } = req.query
    const isAdmin = req.user?.role === 'admin'
    const db = getDB()

    const conversation = await db.collection('conversations').findOne({ _id: id as unknown as ObjectId })

    if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' })
        return
    }

    if (!isAdmin && !conversation.is_visible) {
        const isSharedWithUser = await isConversationSharedWithUser(id, req.user?.id || '')
        if (!isSharedWithUser) {
            res.status(403).json({ error: 'Access denied' })
            return
        }
    }

    const messageLimit = Math.min(parseInt(limit as string) || 50, 10000)

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

router.put('/:id/title', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = toParamString(req.params.id)
    const { title } = req.body

    if (!title || typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ error: 'Title is required' })
        return
    }

    const nextTitle = title.trim().slice(0, 200)
    const db = getDB()

    const result = await db.collection('conversations').updateOne(
        { _id: id as unknown as ObjectId },
        { $set: { title: nextTitle } }
    )

    if (result.matchedCount === 0) {
        res.status(404).json({ error: 'Conversation not found' })
        return
    }

    res.json({ success: true, title: nextTitle })
})

router.put('/:id/visibility', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = toParamString(req.params.id)
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

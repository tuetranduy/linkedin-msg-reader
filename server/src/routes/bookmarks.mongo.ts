import { Router, Response } from 'express'
import { getDB, ObjectId } from '../db/mongodb.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.mongo.js'

const router = Router()

router.use(authenticateToken)

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
    const db = getDB()

    const bookmarks = await db.collection('bookmarks').aggregate([
        { $match: { user_id: req.user!.id } },
        {
            $lookup: {
                from: 'conversations',
                localField: 'conversation_id',
                foreignField: '_id',
                as: 'conversation'
            }
        },
        { $unwind: { path: '$conversation', preserveNullAndEmptyArrays: true } },
        { $sort: { created_at: -1 } },
        {
            $project: {
                _id: 1,
                message_id: 1,
                conversation_id: 1,
                content: 1,
                sender: 1,
                message_date: 1,
                created_at: 1,
                conversation_title: '$conversation.title'
            }
        }
    ], { allowDiskUse: true }).toArray()

    res.json({
        bookmarks: bookmarks.map(b => ({
            id: b._id.toString(),
            message_id: b.message_id,
            conversation_id: b.conversation_id,
            content: b.content,
            sender: b.sender,
            message_date: b.message_date,
            created_at: b.created_at,
            conversation_title: b.conversation_title
        }))
    })
})

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
    const { messageId, conversationId, content, from, date } = req.body

    if (!messageId || !conversationId) {
        res.status(400).json({ error: 'messageId and conversationId required' })
        return
    }

    try {
        const db = getDB()
        const result = await db.collection('bookmarks').insertOne({
            user_id: req.user!.id,
            message_id: messageId,
            conversation_id: conversationId,
            content: (content || '').slice(0, 200),
            sender: from,
            message_date: date ? new Date(date) : null,
            created_at: new Date()
        })

        res.json({
            bookmark: {
                id: result.insertedId.toString(),
                messageId,
                conversationId,
                content: (content || '').slice(0, 200),
                from,
                date
            }
        })
    } catch (err: unknown) {
        if ((err as { code?: number }).code === 11000) {
            res.status(400).json({ error: 'Already bookmarked' })
            return
        }
        throw err
    }
})

router.delete('/:messageId', async (req: AuthRequest, res: Response): Promise<void> => {
    const { messageId } = req.params

    const db = getDB()
    const result = await db.collection('bookmarks').deleteOne({
        user_id: req.user!.id,
        message_id: messageId
    })

    if (result.deletedCount === 0) {
        res.status(404).json({ error: 'Bookmark not found' })
        return
    }

    res.json({ success: true })
})

export default router

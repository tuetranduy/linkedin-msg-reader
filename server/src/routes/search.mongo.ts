import { Router, Response } from 'express'
import { getDB } from '../db/mongodb.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.mongo.js'

const router = Router()

router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
    const query = req.query.q as string
    const isAdmin = req.user?.role === 'admin'

    if (!query || query.length < 2) {
        res.json({ results: [] })
        return
    }

    const db = getDB()
    const searchRegex = new RegExp(query, 'i')

    // Build the aggregation pipeline
    const pipeline: object[] = [
        {
            $match: {
                $or: [
                    { content: searchRegex },
                    { from_name: searchRegex }
                ]
            }
        },
        {
            $lookup: {
                from: 'conversations',
                localField: 'conversation_id',
                foreignField: '_id',
                as: 'conversation'
            }
        },
        { $unwind: { path: '$conversation', preserveNullAndEmptyArrays: true } }
    ]

    // If not admin, filter to only visible conversations
    if (!isAdmin) {
        pipeline.push({
            $match: { 'conversation.is_visible': true }
        })
    }

    pipeline.push(
        { $sort: { date: -1 } },
        { $limit: 100 },
        {
            $project: {
                _id: 1,
                conversation_id: 1,
                content: 1,
                from_name: 1,
                date: 1,
                conversation_title: '$conversation.title'
            }
        }
    )

    const results = await db.collection('messages').aggregate(pipeline).toArray()

    res.json({
        results: results.map(m => ({
            id: m._id,
            conversation_id: m.conversation_id,
            content: m.content,
            sender: m.from_name,
            date: m.date,
            conversation_title: m.conversation_title
        }))
    })
})

export default router

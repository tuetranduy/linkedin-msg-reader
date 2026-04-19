import { Router, Response } from 'express'
import { getDB } from '../db/mongodb.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.mongo.js'

const router = Router()

// Get user's active rooms
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB()
        const userId = req.user!.id

        const rooms = await db.collection('read_rooms').find({
            'participants.user_id': userId
        }).toArray()

        res.json(rooms.map(room => ({
            code: room.code,
            conversationId: room.conversation_id,
            isCreator: room.creator_id === userId,
            participantCount: room.participants.length,
            createdAt: room.created_at
        })))
    } catch (error) {
        console.error('Error fetching rooms:', error)
        res.status(500).json({ error: 'Failed to fetch rooms' })
    }
})

// Get room by code
router.get('/:code', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB()
        const code = (req.params.code as string).toUpperCase()

        const room = await db.collection('read_rooms').findOne({ code })

        if (!room) {
            res.status(404).json({ error: 'Room not found' })
            return
        }

        const userId = req.user!.id
        const isCreator = room.creator_id === userId
        const participant = room.participants.find((p: { user_id: string }) => p.user_id === userId)

        res.json({
            code: room.code,
            conversationId: room.conversation_id,
            isCreator,
            canControl: participant?.can_control || false,
            participants: room.participants.map((p: { user_id: string; username: string; can_control: boolean; socket_id: string }) => ({
                id: p.user_id,
                username: p.username,
                canControl: p.can_control,
                isOnline: !!p.socket_id
            })),
            currentScroll: room.current_scroll,
            createdAt: room.created_at
        })
    } catch (error) {
        console.error('Error fetching room:', error)
        res.status(500).json({ error: 'Failed to fetch room' })
    }
})

// Delete room (creator only)
router.delete('/:code', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB()
        const code = (req.params.code as string).toUpperCase()
        const userId = req.user!.id

        const room = await db.collection('read_rooms').findOne({ code })

        if (!room) {
            res.status(404).json({ error: 'Room not found' })
            return
        }

        if (room.creator_id !== userId) {
            res.status(403).json({ error: 'Only room creator can delete the room' })
            return
        }

        await db.collection('read_rooms').deleteOne({ code })

        res.json({ success: true })
    } catch (error) {
        console.error('Error deleting room:', error)
        res.status(500).json({ error: 'Failed to delete room' })
    }
})

export default router

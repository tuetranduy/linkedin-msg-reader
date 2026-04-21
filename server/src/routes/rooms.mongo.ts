import { Router, Response } from 'express'
import { getDB } from '../db/mongodb.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.mongo.js'

const router = Router()

router.use(authenticateToken)

interface RoomDocument {
    code: string
    name?: string
    description?: string
    conversation_id: string
    creator_id: string
    creator_username?: string
    participants: Array<{
        user_id: string
        username: string
        can_control: boolean
        socket_id?: string | null
    }>
    current_scroll?: {
        message_id: string | null
        position: number
    }
    created_at: Date
    updated_at?: Date
}

function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

function mapRoomSummary(
    room: RoomDocument,
    currentUserId: string,
    isAdmin: boolean,
    conversationTitle: string,
) {
    const participants = room.participants || []
    const isOwner = room.creator_id === currentUserId
    const ownerFromParticipants = participants.find((p) => p.user_id === room.creator_id)
    const creatorUsername = room.creator_username || ownerFromParticipants?.username || 'Unknown'

    return {
        code: room.code,
        name: room.name || `Room ${room.code}`,
        description: room.description || '',
        conversationId: room.conversation_id,
        conversationTitle,
        creatorId: room.creator_id,
        creatorUsername,
        isOwner,
        isParticipant: participants.some((p) => p.user_id === currentUserId),
        canManage: isAdmin || isOwner,
        participantCount: participants.length,
        onlineCount: participants.filter((p) => !!p.socket_id).length,
        createdAt: room.created_at,
        updatedAt: room.updated_at || room.created_at,
    }
}

// Create room (HTTP fallback for socket issues)
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const db = getDB()
        const userId = req.user!.id
        const username = req.user!.username
        const { conversationId } = req.body as { conversationId?: string }

        if (!conversationId || !String(conversationId).trim()) {
            res.status(400).json({ error: 'conversationId is required' })
            return
        }

        let code = ''
        let attempts = 0
        do {
            code = generateRoomCode()
            const existing = await db.collection('read_rooms').findOne({ code })
            if (!existing) break
            attempts++
        } while (attempts < 10)

        if (attempts >= 10) {
            res.status(500).json({ error: 'Failed to generate unique room code' })
            return
        }

        const now = new Date()
        const room: RoomDocument = {
            code,
            name: `Room ${code}`,
            description: '',
            conversation_id: String(conversationId),
            creator_id: userId,
            creator_username: username,
            created_at: now,
            updated_at: now,
            participants: [
                {
                    user_id: userId,
                    username,
                    can_control: true,
                    socket_id: null,
                }
            ],
            current_scroll: {
                message_id: null,
                position: 0,
            }
        }

        await db.collection('read_rooms').insertOne(room)

        res.json({
            code: room.code,
            name: room.name,
            description: room.description,
            conversationId: room.conversation_id,
            isCreator: true,
            canControl: true,
            participants: room.participants.map((p) => ({
                id: p.user_id,
                username: p.username,
                canControl: p.can_control,
                isOnline: !!p.socket_id,
            })),
            currentScroll: {
                messageId: null,
                position: 0,
            }
        })
    } catch (error) {
        console.error('Error creating room via HTTP:', error)
        res.status(500).json({ error: 'Failed to create room' })
    }
})

// Get user's active rooms
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const db = getDB()
        const userId = req.user!.id
        const isAdmin = req.user?.role === 'admin'

        const rooms = await db.collection<RoomDocument>('read_rooms').find({
            'participants.user_id': userId
        }, {
            sort: { created_at: -1 }
        }).toArray()

        const conversationIds = [...new Set(rooms.map((room) => room.conversation_id))]
        const conversations = await db.collection('conversations').find(
            { id: { $in: conversationIds } },
            { projection: { _id: 0, id: 1, title: 1 } }
        ).toArray()
        const conversationTitles = new Map(conversations.map((c) => [c.id, c.title]))

        res.json(rooms.map((room) => {
            const summary = mapRoomSummary(
                room,
                userId,
                isAdmin,
                conversationTitles.get(room.conversation_id) || 'Unknown conversation',
            )

            return {
                ...summary,
                isCreator: summary.isOwner,
            }
        }))
    } catch (error) {
        console.error('Error fetching rooms:', error)
        res.status(500).json({ error: 'Failed to fetch rooms' })
    }
})

// List available rooms for room manager
router.get('/available', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const db = getDB()
        const userId = req.user!.id
        const isAdmin = req.user?.role === 'admin'

        const rooms = await db.collection<RoomDocument>('read_rooms').find(
            {},
            { sort: { created_at: -1 } }
        ).toArray()

        const conversationIds = [...new Set(rooms.map((room) => room.conversation_id))]
        const conversations = await db.collection('conversations').find(
            { id: { $in: conversationIds } },
            { projection: { _id: 0, id: 1, title: 1 } }
        ).toArray()
        const conversationTitles = new Map(conversations.map((c) => [c.id, c.title]))

        const mappedRooms = rooms.map((room) =>
            mapRoomSummary(
                room,
                userId,
                isAdmin,
                conversationTitles.get(room.conversation_id) || 'Unknown conversation',
            )
        )

        res.json({ rooms: mappedRooms })
    } catch (error) {
        console.error('Error fetching available rooms:', error)
        res.status(500).json({ error: 'Failed to fetch available rooms' })
    }
})

// Get room by code
router.get('/:code', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const db = getDB()
        const code = (req.params.code as string).toUpperCase()

        const room = await db.collection<RoomDocument>('read_rooms').findOne({ code })

        if (!room) {
            res.status(404).json({ error: 'Room not found' })
            return
        }

        const userId = req.user!.id
        const isCreator = room.creator_id === userId
        const participants = room.participants || []
        const participant = participants.find((p: { user_id: string }) => p.user_id === userId)

        res.json({
            code: room.code,
            name: room.name || `Room ${room.code}`,
            description: room.description || '',
            conversationId: room.conversation_id,
            isCreator,
            canControl: participant?.can_control || false,
            participants: participants.map((p: { user_id: string; username: string; can_control: boolean; socket_id?: string | null }) => ({
                id: p.user_id,
                username: p.username,
                canControl: p.can_control,
                isOnline: !!p.socket_id
            })),
            currentScroll: room.current_scroll,
            updatedAt: room.updated_at || room.created_at,
            createdAt: room.created_at
        })
    } catch (error) {
        console.error('Error fetching room:', error)
        res.status(500).json({ error: 'Failed to fetch room' })
    }
})

// Update room metadata (admin or room owner)
router.put('/:code', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const db = getDB()
        const code = (req.params.code as string).toUpperCase()
        const userId = req.user!.id
        const isAdmin = req.user?.role === 'admin'
        const { name, description } = req.body as { name?: string; description?: string }

        if (typeof name === 'undefined' && typeof description === 'undefined') {
            res.status(400).json({ error: 'At least one field (name or description) is required' })
            return
        }

        const room = await db.collection<RoomDocument>('read_rooms').findOne({ code })

        if (!room) {
            res.status(404).json({ error: 'Room not found' })
            return
        }

        if (!isAdmin && room.creator_id !== userId) {
            res.status(403).json({ error: 'Only admin or room owner can edit the room' })
            return
        }

        const updates: { name?: string; description?: string; updated_at: Date } = {
            updated_at: new Date(),
        }

        if (typeof name !== 'undefined') {
            const trimmedName = String(name).trim()
            if (!trimmedName) {
                res.status(400).json({ error: 'Room name cannot be empty' })
                return
            }
            if (trimmedName.length > 80) {
                res.status(400).json({ error: 'Room name must be at most 80 characters' })
                return
            }
            updates.name = trimmedName
        }

        if (typeof description !== 'undefined') {
            const trimmedDescription = String(description).trim()
            if (trimmedDescription.length > 240) {
                res.status(400).json({ error: 'Room description must be at most 240 characters' })
                return
            }
            updates.description = trimmedDescription
        }

        await db.collection('read_rooms').updateOne(
            { code },
            { $set: updates }
        )

        const updatedRoom = await db.collection<RoomDocument>('read_rooms').findOne({ code })

        if (!updatedRoom) {
            res.status(500).json({ error: 'Failed to fetch updated room' })
            return
        }

        res.json({
            success: true,
            room: {
                code: updatedRoom.code,
                name: updatedRoom.name || `Room ${updatedRoom.code}`,
                description: updatedRoom.description || '',
                updatedAt: updatedRoom.updated_at || updatedRoom.created_at,
            }
        })
    } catch (error) {
        console.error('Error updating room:', error)
        res.status(500).json({ error: 'Failed to update room' })
    }
})

// Delete room (admin or room owner)
router.delete('/:code', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const db = getDB()
        const code = (req.params.code as string).toUpperCase()
        const userId = req.user!.id
        const isAdmin = req.user?.role === 'admin'

        const room = await db.collection<RoomDocument>('read_rooms').findOne({ code })

        if (!room) {
            res.status(404).json({ error: 'Room not found' })
            return
        }

        if (!isAdmin && room.creator_id !== userId) {
            res.status(403).json({ error: 'Only admin or room owner can delete the room' })
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

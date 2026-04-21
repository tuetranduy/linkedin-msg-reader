import { Server } from 'socket.io'
import { getDB, ObjectId } from '../db/mongodb.js'
import { AuthenticatedSocket } from './auth.js'

// Generate 6-character alphanumeric room code
function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excluded confusing chars: I, O, 0, 1
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

export function setupSocketHandlers(io: Server): void {
    io.on('connection', async (socket: AuthenticatedSocket) => {
        const user = socket.user
        if (!user) {
            socket.disconnect()
            return
        }

        console.log(`User connected: ${user.username} (${socket.id})`)

        // Create a new room
        socket.on('room:create', async (data: { conversationId: string }, callback) => {
            try {
                const db = getDB()

                // Generate unique room code
                let code: string
                let attempts = 0
                do {
                    code = generateRoomCode()
                    const existing = await db.collection('read_rooms').findOne({ code })
                    if (!existing) break
                    attempts++
                } while (attempts < 10)

                if (attempts >= 10) {
                    return callback({ error: 'Failed to generate unique room code' })
                }

                // Create room in database
                const room = {
                    code,
                    name: `Room ${code}`,
                    description: '',
                    conversation_id: data.conversationId,
                    creator_id: user.id,
                    creator_username: user.username,
                    created_at: new Date(),
                    updated_at: new Date(),
                    participants: [{
                        user_id: user.id,
                        username: user.username,
                        can_control: true,
                        socket_id: socket.id,
                        joined_at: new Date()
                    }],
                    current_scroll: {
                        message_id: null as string | null,
                        position: 0
                    }
                }

                await db.collection('read_rooms').insertOne(room)

                // Join socket room
                socket.join(`room:${code}`)

                callback({
                    success: true,
                    room: {
                        code: room.code,
                        name: room.name,
                        description: room.description,
                        conversationId: room.conversation_id,
                        isCreator: true,
                        canControl: true,
                        participants: room.participants.map(p => ({
                            id: p.user_id,
                            username: p.username,
                            canControl: p.can_control,
                            isOnline: true
                        }))
                    }
                })

                console.log(`Room created: ${code} by ${user.username}`)
            } catch (error) {
                console.error('Error creating room:', error)
                callback({ error: 'Failed to create room' })
            }
        })

        // Join an existing room
        socket.on('room:join', async (data: { code: string }, callback) => {
            try {
                const db = getDB()
                const code = data.code.toUpperCase()

                const room = await db.collection('read_rooms').findOne({ code })

                if (!room) {
                    return callback({ error: 'Room not found' })
                }

                // Check if user is already in room
                const existingParticipant = room.participants.find((p: { user_id: string }) => p.user_id === user.id)

                if (existingParticipant) {
                    // Update socket ID for reconnection
                    await db.collection('read_rooms').updateOne(
                        { code, 'participants.user_id': user.id },
                        { $set: { 'participants.$.socket_id': socket.id } }
                    )
                } else {
                    // Add new participant (default: cannot control)
                    await db.collection('read_rooms').updateOne(
                        { code },
                        {
                            $push: {
                                participants: {
                                    user_id: user.id,
                                    username: user.username,
                                    can_control: false,
                                    socket_id: socket.id,
                                    joined_at: new Date()
                                }
                            } as any
                        }
                    )
                }

                // Join socket room
                socket.join(`room:${code}`)

                // Get updated room
                const updatedRoom = await db.collection('read_rooms').findOne({ code })

                // Notify others
                socket.to(`room:${code}`).emit('room:user-joined', {
                    user: { id: user.id, username: user.username }
                })

                const isCreator = room.creator_id === user.id
                const participant = updatedRoom?.participants.find((p: { user_id: string }) => p.user_id === user.id)

                callback({
                    success: true,
                    room: {
                        code: room.code,
                        name: room.name || `Room ${room.code}`,
                        description: room.description || '',
                        conversationId: room.conversation_id,
                        isCreator,
                        canControl: participant?.can_control || false,
                        participants: updatedRoom?.participants.map((p: { user_id: string; username: string; can_control: boolean; socket_id: string }) => ({
                            id: p.user_id,
                            username: p.username,
                            canControl: p.can_control,
                            isOnline: !!p.socket_id
                        })),
                        currentScroll: room.current_scroll
                    }
                })

                console.log(`User ${user.username} joined room: ${code}`)
            } catch (error) {
                console.error('Error joining room:', error)
                callback({ error: 'Failed to join room' })
            }
        })

        // Leave room
        socket.on('room:leave', async (data: { code: string }, callback) => {
            try {
                const db = getDB()
                const code = data.code.toUpperCase()

                const room = await db.collection('read_rooms').findOne({ code })

                if (!room) {
                    return callback?.({ error: 'Room not found' })
                }

                // Remove participant from room
                await db.collection('read_rooms').updateOne(
                    { code },
                    { $pull: { participants: { user_id: user.id } } as any }
                )

                // Leave socket room
                socket.leave(`room:${code}`)

                // Notify others
                socket.to(`room:${code}`).emit('room:user-left', {
                    user: { id: user.id, username: user.username }
                })

                // Check if room is empty and delete if so
                const updatedRoom = await db.collection('read_rooms').findOne({ code })
                if (updatedRoom && updatedRoom.participants.length === 0) {
                    await db.collection('read_rooms').deleteOne({ code })
                    console.log(`Room ${code} deleted (empty)`)
                }

                callback?.({ success: true })
                console.log(`User ${user.username} left room: ${code}`)
            } catch (error) {
                console.error('Error leaving room:', error)
                callback?.({ error: 'Failed to leave room' })
            }
        })

        // Scroll sync - broadcast scroll position
        socket.on('room:scroll', async (data: { code: string; messageId: string | null; position: number }) => {
            try {
                const db = getDB()
                const code = data.code.toUpperCase()

                const room = await db.collection('read_rooms').findOne({ code })

                if (!room) return

                // Check if user has control permission
                const participant = room.participants.find((p: { user_id: string }) => p.user_id === user.id)
                if (!participant?.can_control) {
                    socket.emit('room:error', { message: 'You do not have scroll control permission' })
                    return
                }

                // Update current scroll in database
                await db.collection('read_rooms').updateOne(
                    { code },
                    {
                        $set: {
                            current_scroll: {
                                message_id: data.messageId,
                                position: data.position
                            }
                        }
                    }
                )

                // Broadcast to all others in room
                socket.to(`room:${code}`).emit('room:scroll-sync', {
                    messageId: data.messageId,
                    position: data.position,
                    from: { id: user.id, username: user.username }
                })
            } catch (error) {
                console.error('Error syncing scroll:', error)
            }
        })

        // Update participant permissions (creator only)
        socket.on('room:permissions', async (data: { code: string; userId: string; canControl: boolean }, callback) => {
            try {
                const db = getDB()
                const code = data.code.toUpperCase()

                const room = await db.collection('read_rooms').findOne({ code })

                if (!room) {
                    return callback?.({ error: 'Room not found' })
                }

                // Only admin or creator can change permissions
                if (room.creator_id !== user.id && user.role !== 'admin') {
                    return callback?.({ error: 'Only admin or room creator can change permissions' })
                }

                // Update participant permission
                await db.collection('read_rooms').updateOne(
                    { code, 'participants.user_id': data.userId },
                    { $set: { 'participants.$.can_control': data.canControl } }
                )

                // Notify the affected user
                const targetParticipant = room.participants.find((p: { user_id: string }) => p.user_id === data.userId)
                if (targetParticipant?.socket_id) {
                    io.to(targetParticipant.socket_id).emit('room:permission-changed', {
                        canControl: data.canControl
                    })
                }

                // Broadcast to all in room
                io.to(`room:${code}`).emit('room:participants-updated', {
                    userId: data.userId,
                    canControl: data.canControl
                })

                callback?.({ success: true })
                console.log(`Permission updated for ${data.userId} in room ${code}: canControl=${data.canControl}`)
            } catch (error) {
                console.error('Error updating permissions:', error)
                callback?.({ error: 'Failed to update permissions' })
            }
        })

        // End room (creator only)
        socket.on('room:end', async (data: { code: string }, callback) => {
            try {
                const db = getDB()
                const code = data.code.toUpperCase()

                const room = await db.collection('read_rooms').findOne({ code })

                if (!room) {
                    return callback?.({ error: 'Room not found' })
                }

                // Only admin or creator can end room
                if (room.creator_id !== user.id && user.role !== 'admin') {
                    return callback?.({ error: 'Only admin or room creator can end the room' })
                }

                // Notify all participants
                io.to(`room:${code}`).emit('room:ended', {
                    by: { id: user.id, username: user.username }
                })

                // Delete room
                await db.collection('read_rooms').deleteOne({ code })

                callback?.({ success: true })
                console.log(`Room ${code} ended by ${user.username}`)
            } catch (error) {
                console.error('Error ending room:', error)
                callback?.({ error: 'Failed to end room' })
            }
        })

        // Handle disconnect
        socket.on('disconnect', async () => {
            try {
                const db = getDB()

                // Find all rooms user was in and update socket_id
                await db.collection('read_rooms').updateMany(
                    { 'participants.user_id': user.id },
                    { $set: { 'participants.$.socket_id': null } }
                )

                // Notify rooms about user going offline
                const rooms = await db.collection('read_rooms').find({
                    'participants.user_id': user.id
                }).toArray()

                for (const room of rooms) {
                    socket.to(`room:${room.code}`).emit('room:user-offline', {
                        user: { id: user.id, username: user.username }
                    })
                }

                console.log(`User disconnected: ${user.username}`)
            } catch (error) {
                console.error('Error handling disconnect:', error)
            }
        })

        // Get room info
        socket.on('room:info', async (data: { code: string }, callback) => {
            try {
                const db = getDB()
                const code = data.code.toUpperCase()

                const room = await db.collection('read_rooms').findOne({ code })

                if (!room) {
                    return callback({ error: 'Room not found' })
                }

                const isCreator = room.creator_id === user.id
                const participant = room.participants.find((p: { user_id: string }) => p.user_id === user.id)

                callback({
                    success: true,
                    room: {
                        code: room.code,
                        name: room.name || `Room ${room.code}`,
                        description: room.description || '',
                        conversationId: room.conversation_id,
                        isCreator,
                        canControl: participant?.can_control || false,
                        participants: room.participants.map((p: { user_id: string; username: string; can_control: boolean; socket_id: string }) => ({
                            id: p.user_id,
                            username: p.username,
                            canControl: p.can_control,
                            isOnline: !!p.socket_id
                        })),
                        currentScroll: room.current_scroll
                    }
                })
            } catch (error) {
                console.error('Error getting room info:', error)
                callback({ error: 'Failed to get room info' })
            }
        })
    })
}

import { Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { getDB, ObjectId } from '../db/mongodb.js'

const JWT_SECRET = process.env.JWT_SECRET || 'linkedin-msg-secret-key-change-in-production'

export interface SocketUser {
    id: string
    username: string
    role: 'admin' | 'user'
}

export interface AuthenticatedSocket extends Socket {
    user?: SocketUser
}

export async function authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error) => void): Promise<void> {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1]

        if (!token) {
            return next(new Error('Authentication required'))
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
        const db = getDB()
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(decoded.userId) },
            { projection: { _id: 1, username: 1, role: 1 } }
        )

        if (!user) {
            return next(new Error('User not found'))
        }

        socket.user = {
            id: user._id.toString(),
            username: user.username,
            role: user.role
        }

        next()
    } catch (error) {
        next(new Error('Invalid token'))
    }
}

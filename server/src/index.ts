import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'

// Import MongoDB connection
import { connectDB } from './db/mongodb.js'

// Import Socket.io setup
import { authenticateSocket } from './socket/auth.js'
import { setupSocketHandlers } from './socket/handlers.js'

import authRoutes from './routes/auth.mongo.js'
import usersRoutes from './routes/users.mongo.js'
import conversationsRoutes from './routes/conversations.mongo.js'
import messagesRoutes from './routes/messages.mongo.js'
import bookmarksRoutes from './routes/bookmarks.mongo.js'
import searchRoutes from './routes/search.mongo.js'
import roomsRoutes from './routes/rooms.mongo.js'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? ['https://linkedin.tuetran.dev']
            : ['http://localhost:5173', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
    }
})
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/conversations', conversationsRoutes)
app.use('/api/messages', messagesRoutes)
app.use('/api/bookmarks', bookmarksRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/rooms', roomsRoutes)

// Socket.io authentication and handlers
io.use(authenticateSocket)
setupSocketHandlers(io)

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err.stack)
    res.status(500).json({ error: 'Internal server error' })
})

// Connect to MongoDB and start server
async function startServer() {
    try {
        await connectDB()
        console.log('Database initialized')
        httpServer.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`)
            console.log('Socket.io enabled for real-time features')
        })
    } catch (error) {
        console.error('Failed to start server:', error)
        process.exit(1)
    }
}

startServer()

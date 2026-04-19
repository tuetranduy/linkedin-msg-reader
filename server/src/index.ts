import express from 'express'
import cors from 'cors'

// Import db first to initialize
import './db/database.js'

import authRoutes from './routes/auth.js'
import usersRoutes from './routes/users.js'
import conversationsRoutes from './routes/conversations.js'
import messagesRoutes from './routes/messages.js'
import bookmarksRoutes from './routes/bookmarks.js'
import searchRoutes from './routes/search.js'

const app = express()
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

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err.stack)
    res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})

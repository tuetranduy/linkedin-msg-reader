---
description: "Use when writing or modifying backend routes, middleware, database queries, or authentication logic. Covers Express route patterns, MongoDB native driver usage, JWT auth, Socket.io, and API conventions."
applyTo: "server/src/**/*.ts"
---

# Backend API Patterns

## Route Files

- Place routes in `server/src/routes/*.mongo.ts`
- Register all routes in `server/src/index.ts` under `/api/<resource>`
- Apply `authenticateToken` middleware at the router level (not per-route) unless a route must be public

```ts
// Pattern: router-level auth
router.use(authenticateToken)

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => { ... })
```

## MongoDB Access

- Import `getDB()` and `ObjectId` from `../db/mongodb.js` (use `.js` extension for ESM)
- Never create new `MongoClient` instances in routes — always use `getDB()`
- Indexes are created once in `db/mongodb.ts` at startup — add new indexes there

```ts
import { getDB, ObjectId } from '../db/mongodb.js'
const db = getDB()
const result = await db.collection('collectionName').findOne({ ... })
```

## Auth Middleware

- `authenticateToken` — validates Bearer JWT, attaches `req.user: { id, username, role }`
- `requireAdmin` — asserts `req.user.role === 'admin'`, use after `authenticateToken`
- Use `AuthRequest` (not `Request`) for typed access to `req.user`

```ts
import {
  authenticateToken,
  requireAdmin,
  AuthRequest,
} from "../middleware/auth.mongo.js";
```

## JWT & Passwords

- JWT secret from `process.env.JWT_SECRET`, never hardcode in production
- Token expiry: 24 hours (`expiresIn: '24h'`)
- Passwords hashed with `bcrypt`, salt rounds: `12`
- Token storage: `auth_token` key in localStorage (frontend)

## Error Responses

Return consistent JSON error shapes:

```ts
res.status(404).json({ error: "Resource not found" });
res.status(403).json({ error: "Access denied" });
res.status(401).json({ error: "Authentication required" });
res.status(500).json({ error: "Internal server error" });
```

## Admin vs User Access

- Check `req.user?.role === 'admin'` inline for visibility filters
- Admins see all records; users only see `is_visible: true` records

```ts
const isAdmin = req.user?.role === "admin";
const filter = isAdmin ? {} : { is_visible: true };
```

## Socket.io

- Auth via `authenticateSocket` in `socket/auth.ts` (same JWT validation)
- Handlers in `socket/handlers.ts`
- CORS origins explicitly listed in `server/src/index.ts`

## TypeScript Conventions

- All route handlers typed as `async (req: AuthRequest, res: Response): Promise<void>`
- Use `.js` extension in all relative imports (ESM Node.js)
- `tsconfig.json` targets ES2022 with `"module": "NodeNext"`

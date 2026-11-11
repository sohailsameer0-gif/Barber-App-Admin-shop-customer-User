import { Hono } from 'hono'

import { authMode, getAuth, optionalUser, requireAuth } from './auth'
import { requireDb } from './db'
import type { AppContext, Env } from './env'
import { adminRoutes } from './routes/admin'
import { bookings } from './routes/bookings'
import { catalog } from './routes/catalog'
import { me } from './routes/me'
import { shopRoutes } from './routes/shop'

const app = new Hono<AppContext>()

// Public: lets the app know how to sign in before any private call.
app.get('/api/auth/status', (c) => {
  const mode = authMode(c.env, c.req.raw)
  c.header('Cache-Control', 'private, no-store')
  return c.json({ mode, database: Boolean(c.env.DB) })
})

app.get('/api/health', (c) => c.json({ ok: true }))

// Customers browse, book and cancel without an account; the shop console and
// the admin area stay behind sign-in.
const api = new Hono<AppContext>()
api.use('*', optionalUser, requireDb)
api.route('/', catalog)
api.route('/bookings', bookings)
api.route('/', me)
api.use('/shop', requireAuth)
api.use('/shop/*', requireAuth)
api.use('/admin', requireAuth)
api.use('/admin/*', requireAuth)
api.route('/shop', shopRoutes)
api.route('/admin', adminRoutes)
app.route('/api', api)

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'Something went wrong.' }, 500)
})

app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'Not found.' }, 404) : c.env.ASSETS.fetch(c.req.raw)))

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Sign in with Freebuff owns /auth/freebuff/* and keeps sessions fresh. It
    // wraps the whole app once per isolate; without a client ID the app falls
    // back to the loopback development user (see auth.ts).
    const auth = getAuth(env, request)
    const handler = (req: Request) => Promise.resolve(app.fetch(req, env, ctx))
    return auth ? auth.wrap(handler)(request) : handler(request)
  },
}

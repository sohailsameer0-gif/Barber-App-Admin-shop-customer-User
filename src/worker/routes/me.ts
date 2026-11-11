import { Hono } from 'hono'

import { authMode, maybeUser, privateJson, requireAuth } from '../auth'
import { now } from '../db'
import type { AppContext } from '../env'
import { ensureProfile, isAdminUser, ownedShop } from '../roles'
import { seedIfEmpty } from '../seed'

export const me = new Hono<AppContext>()

// Public: the app asks who is signed in on every load. Guests get nulls and
// keep browsing, booking and cancelling without an account.
me.get('/me', async (c) => {
  const db = c.get('db')
  await seedIfEmpty(db)
  const capabilities = {
    database: Boolean(c.env.DB),
    auth: authMode(c.env, c.req.raw) === 'freebuff' ? ('freebuff' as const) : ('development' as const),
  }
  const user = maybeUser(c)
  if (!user) return privateJson(c, { user: null, profile: null, shop: null, capabilities })
  const profile = await ensureProfile(db, user)
  const shop = await ownedShop(db, user.sub)
  return privateJson(c, {
    user: { sub: user.sub, name: user.name, email: user.email, picture: user.picture },
    profile: {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      city: profile.city,
      isAdmin: isAdminUser(c.env, profile),
    },
    shop: shop
      ? {
          id: shop.id as string,
          name: shop.name as string,
          status: shop.status as 'pending' | 'approved' | 'suspended',
          city: shop.city as string,
          area: shop.area as string,
        }
      : null,
    capabilities,
  })
})

me.patch('/me', requireAuth, async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const profile = await ensureProfile(db, user)
  const body = await c.req.json<{ name?: string; phone?: string | null; city?: string | null }>()
  const name = body.name === undefined ? profile.name : body.name.trim().slice(0, 80)
  if (!name) return c.json({ error: 'Name is required.' }, 400)
  const phone = body.phone === undefined ? profile.phone : (body.phone ?? '').trim().slice(0, 40) || null
  const city = body.city === undefined ? profile.city : (body.city ?? '').trim().slice(0, 60) || null
  await db.prepare(`UPDATE profiles SET name = ?, phone = ?, city = ? WHERE sub = ?`).bind(name, phone, city, user.sub).run()
  return privateJson(c, {
    profile: { name, email: profile.email, phone, city, isAdmin: isAdminUser(c.env, { ...profile, name, phone, city }) },
    updatedAt: now(),
  })
})

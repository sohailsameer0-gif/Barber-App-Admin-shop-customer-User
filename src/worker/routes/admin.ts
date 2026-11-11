import { Hono } from 'hono'

import { PLATFORM_FEE_PERCENT } from '../../shared/types'
import { privateJson } from '../auth'
import { APPOINTMENT_SELECT, DAY, dayLabel, dateKeysBack, mapAppointment, now } from '../db'
import type { AppContext } from '../env'
import { ensureProfile, isAdminUser, type ProfileRow } from '../roles'

export const adminRoutes = new Hono<AppContext>()

adminRoutes.use('*', async (c, next) => {
  const profile = await ensureProfile(c.get('db'), c.get('user'))
  if (!isAdminUser(c.env, profile)) return c.json({ error: 'Admin access required.' }, 403)
  await next()
})

type Row = Record<string, unknown>

adminRoutes.get('/overview', async (c) => {
  const db = c.get('db')
  const [totals, bookingsCount, shopCounts, customers, reviews, seriesRows, cities, topShops, recent] = await db.batch([
    db.prepare(`SELECT COALESCE(SUM(price_pkr), 0) AS gmv, COUNT(*) AS n FROM appointments WHERE status = 'completed'`),
    db.prepare(`SELECT COUNT(*) AS n FROM appointments WHERE status != 'cancelled'`),
    db.prepare(`SELECT status, COUNT(*) AS n FROM shops GROUP BY status`),
    db.prepare(`SELECT COUNT(DISTINCT customer_sub) AS n FROM appointments WHERE customer_sub NOT LIKE 'walkin:%'`),
    db.prepare(`SELECT AVG(rating) AS rating, COUNT(*) AS n FROM reviews`),
    db
      .prepare(`SELECT starts_at, price_pkr FROM appointments WHERE status = 'completed' AND starts_at >= ?`)
      .bind(now() - 14 * DAY),
    db
      .prepare(
        `SELECT s.city, COUNT(DISTINCT s.id) AS shops,
           COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.price_pkr ELSE 0 END), 0) AS revenue
         FROM shops s LEFT JOIN appointments a ON a.shop_id = s.id
         GROUP BY s.city ORDER BY revenue DESC, shops DESC`,
      ),
    db
      .prepare(
        `SELECT s.id, s.name, s.city,
           (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.shop_id = s.id) AS rating,
           (SELECT COALESCE(SUM(a.price_pkr), 0) FROM appointments a WHERE a.shop_id = s.id AND a.status = 'completed') AS revenue,
           (SELECT COUNT(*) FROM appointments a WHERE a.shop_id = s.id AND a.status != 'cancelled') AS bookings
         FROM shops s ORDER BY revenue DESC LIMIT 6`,
      ),
    db.prepare(`${APPOINTMENT_SELECT} ORDER BY a.created_at DESC LIMIT 8`),
  ])

  const gmv = Number((totals.results[0] as { gmv: number }).gmv)
  const byStatus = new Map((shopCounts.results as { status: string; n: number }[]).map((row) => [row.status, Number(row.n)]))
  const bucket = new Map<string, number>()
  for (const row of seriesRows.results as { starts_at: number; price_pkr: number }[]) {
    const key = new Date(Number(row.starts_at) + 5 * 3_600_000).toISOString().slice(0, 10)
    bucket.set(key, (bucket.get(key) ?? 0) + Number(row.price_pkr))
  }
  const rating = (reviews.results[0] as { rating: number | null }).rating

  return privateJson(c, {
    kpis: {
      gmv,
      commission: Math.round((gmv * PLATFORM_FEE_PERCENT) / 100),
      bookings: Number((bookingsCount.results[0] as { n: number }).n),
      completed: Number((totals.results[0] as { n: number }).n),
      pendingShops: byStatus.get('pending') ?? 0,
      approvedShops: byStatus.get('approved') ?? 0,
      customers: Number((customers.results[0] as { n: number }).n),
      avgRating: rating === null || rating === undefined ? null : Number(rating),
    },
    series: dateKeysBack(14).map((key) => ({ label: dayLabel(key), value: bucket.get(key) ?? 0 })),
    cities: (cities.results as { city: string; shops: number; revenue: number }[]).map((row) => ({
      city: row.city,
      shops: Number(row.shops),
      revenue: Number(row.revenue),
    })),
    topShops: (topShops.results as Row[]).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      city: row.city as string,
      revenue: Number(row.revenue ?? 0),
      bookings: Number(row.bookings ?? 0),
      rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    })),
    recent: (recent.results as Row[]).map(mapAppointment),
  })
})

adminRoutes.get('/shops', async (c) => {
  const db = c.get('db')
  const status = c.req.query('status')
  const where = status && ['pending', 'approved', 'suspended'].includes(status) ? `WHERE s.status = '${status}'` : ''
  const rows = await db
    .prepare(
      `SELECT s.*, p.email AS owner_email, p.name AS owner_name,
         (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.shop_id = s.id) AS rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.shop_id = s.id) AS review_count,
         (SELECT COALESCE(SUM(a.price_pkr), 0) FROM appointments a WHERE a.shop_id = s.id AND a.status = 'completed') AS revenue,
         (SELECT COUNT(*) FROM appointments a WHERE a.shop_id = s.id AND a.status != 'cancelled') AS bookings
       FROM shops s LEFT JOIN profiles p ON p.sub = s.owner_sub
       ${where}
       ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END, s.created_at DESC
       LIMIT 200`,
    )
    .all<Row>()
  return privateJson(c, {
    items: rows.results.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      city: row.city as string,
      area: row.area as string,
      ownerSub: row.owner_sub as string,
      ownerEmail: (row.owner_email as string | null) ?? null,
      ownerName: (row.owner_name as string | null) ?? null,
      status: row.status as 'pending' | 'approved' | 'suspended',
      hue: Number(row.hue ?? 150),
      rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
      reviewCount: Number(row.review_count ?? 0),
      revenue: Number(row.revenue ?? 0),
      bookings: Number(row.bookings ?? 0),
      createdAt: Number(row.created_at),
    })),
  })
})

adminRoutes.post('/shops/:id/status', async (c) => {
  const db = c.get('db')
  const body = await c.req.json<{ status?: string }>()
  if (!body.status || !['pending', 'approved', 'suspended'].includes(body.status)) {
    return c.json({ error: 'Unknown status.' }, 400)
  }
  const shop = await db.prepare(`SELECT id FROM shops WHERE id = ?`).bind(c.req.param('id')).first()
  if (!shop) return c.json({ error: 'Shop not found.' }, 404)
  await db.prepare(`UPDATE shops SET status = ?, updated_at = ? WHERE id = ?`).bind(body.status, now(), c.req.param('id')).run()
  return privateJson(c, { ok: true, status: body.status })
})

adminRoutes.get('/users', async (c) => {
  const db = c.get('db')
  const rows = await db
    .prepare(
      `SELECT p.*,
         (SELECT COUNT(*) FROM shops s WHERE s.owner_sub = p.sub) AS shops,
         (SELECT COUNT(*) FROM appointments a WHERE a.customer_sub = p.sub) AS bookings
       FROM profiles p ORDER BY p.created_at DESC LIMIT 200`,
    )
    .all<ProfileRow & { shops: number; bookings: number }>()
  return privateJson(c, {
    items: rows.results.map((row) => ({
      sub: row.sub,
      name: row.name,
      email: row.email,
      isAdmin: isAdminUser(c.env, row),
      shops: Number(row.shops ?? 0),
      bookings: Number(row.bookings ?? 0),
      joinedAt: Number(row.created_at),
    })),
  })
})

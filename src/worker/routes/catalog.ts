import { Hono } from 'hono'

import { privateJson } from '../auth'
import { mapBarber, mapReview, mapService, mapShop, REVIEW_SELECT, SHOP_SELECT } from '../db'
import type { AppContext } from '../env'
import { availability } from '../slots'

export const catalog = new Hono<AppContext>()

catalog.get('/shops', async (c) => {
  const db = c.get('db')
  const q = (c.req.query('q') ?? '').trim()
  const city = (c.req.query('city') ?? '').trim()
  const area = (c.req.query('area') ?? '').trim()
  const sort = c.req.query('sort')

  const where: string[] = [`s.status = 'approved'`]
  const binds: unknown[] = []
  if (q) {
    where.push(`(s.name LIKE ? OR s.area LIKE ? OR s.city LIKE ? OR s.description LIKE ?)`)
    const like = `%${q.replace(/[%_]/g, '')}%`
    binds.push(like, like, like, like)
  }
  if (city) {
    where.push(`s.city = ?`)
    binds.push(city)
  }
  if (area) {
    where.push(`s.area LIKE ?`)
    binds.push(`%${area}%`)
  }
  const order =
    sort === 'price' ? `COALESCE(price_from, 999999) ASC, rating DESC` : sort === 'new' ? `s.created_at DESC` : `rating DESC, review_count DESC, s.name ASC`

  const [rows, cities] = await db.batch([
    db.prepare(`${SHOP_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 60`).bind(...binds),
    db
      .prepare(`SELECT city, COUNT(*) AS n FROM shops WHERE status = 'approved' GROUP BY city ORDER BY n DESC, city`)
      .bind(),
  ])

  return privateJson(c, {
    items: (rows.results as Record<string, unknown>[]).map(mapShop),
    cities: (cities.results as { city: string; n: number }[]).map((row) => ({ city: row.city, count: Number(row.n) })),
  })
})

catalog.get('/shops/:id', async (c) => {
  const db = c.get('db')
  const shopId = c.req.param('id')
  const [shopRow, services, barbers, reviews] = await db.batch([
    db.prepare(`${SHOP_SELECT} WHERE s.id = ? AND s.status = 'approved'`).bind(shopId),
    db.prepare(`SELECT * FROM services WHERE shop_id = ? AND active = 1 ORDER BY sort, price_pkr`).bind(shopId),
    db.prepare(`SELECT * FROM barbers WHERE shop_id = ? AND active = 1 ORDER BY created_at`).bind(shopId),
    db.prepare(`${REVIEW_SELECT} WHERE r.shop_id = ? ORDER BY r.created_at DESC LIMIT 30`).bind(shopId),
  ])
  const shop = shopRow.results[0]
  if (!shop) return c.json({ error: 'Shop not found.' }, 404)
  return privateJson(c, {
    shop: mapShop(shop as Record<string, unknown>),
    services: (services.results as Record<string, unknown>[]).map(mapService),
    barbers: (barbers.results as Record<string, unknown>[]).map(mapBarber),
    reviews: (reviews.results as Record<string, unknown>[]).map(mapReview),
  })
})

catalog.get('/shops/:id/availability', async (c) => {
  const db = c.get('db')
  const shopId = c.req.param('id')
  const date = c.req.query('date') ?? ''
  const serviceId = c.req.query('serviceId') ?? ''
  const barberId = c.req.query('barberId')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return c.json({ error: 'Pick a valid date.' }, 400)
  }
  const [shop, service] = await db.batch([
    db.prepare(`SELECT id, opens_at, closes_at, status FROM shops WHERE id = ?`).bind(shopId),
    db.prepare(`SELECT id, duration_min FROM services WHERE id = ? AND shop_id = ? AND active = 1`).bind(serviceId, shopId),
  ])
  const shopRow = shop.results[0] as { id: string; opens_at: string; closes_at: string; status: string } | undefined
  const serviceRow = service.results[0] as { id: string; duration_min: number } | undefined
  if (!shopRow || shopRow.status !== 'approved') return c.json({ error: 'Shop not found.' }, 404)
  if (!serviceRow) return c.json({ error: 'Pick a service first.' }, 400)
  const result = await availability(db, shopRow, date, Number(serviceRow.duration_min), barberId && barberId !== 'any' ? barberId : null)
  return privateJson(c, result)
})

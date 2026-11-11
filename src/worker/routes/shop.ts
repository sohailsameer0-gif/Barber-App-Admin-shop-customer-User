import { Hono } from 'hono'
import type { Context } from 'hono'

import { privateJson } from '../auth'
import {
  APPOINTMENT_SELECT,
  DAY,
  dayLabel,
  dateKeysBack,
  hueFor,
  id,
  mapAppointment,
  mapBarber,
  mapReview,
  mapService,
  mapShop,
  now,
  parseClock,
  pkStamp,
  REVIEW_SELECT,
  SHOP_SELECT,
  todayKey,
} from '../db'
import type { AppContext } from '../env'
import { ensureProfile, ownedShop } from '../roles'
import { availability, freeBarber } from '../slots'

export const shopRoutes = new Hono<AppContext>()

type Row = Record<string, unknown>

const SHOP_MISSING = { error: 'shop_missing', message: 'Set up your shop first.' }
const STATUSES = new Set(['pending', 'confirmed', 'completed', 'cancelled', 'no_show'])

async function loadShop(c: Context<AppContext>) {
  const row = await ownedShop(c.get('db'), c.get('user').sub)
  return (row as Row | null) ?? null
}

shopRoutes.get('/', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const shopId = shop.id as string
  const today = todayKey()
  const dayStart = pkStamp(today, 0)
  const tomorrowStart = dayStart + DAY

  const [todayRow, weekRow, monthRow, pendingRow, reviewRow, customerRow, todayList, pendingList, completed, topServices] = await db.batch([
    db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN status = 'completed' THEN price_pkr ELSE 0 END), 0) AS revenue
         FROM appointments WHERE shop_id = ? AND starts_at >= ? AND starts_at < ? AND status != 'cancelled'`,
      )
      .bind(shopId, dayStart, tomorrowStart),
    db
      .prepare(`SELECT COALESCE(SUM(price_pkr), 0) AS revenue FROM appointments WHERE shop_id = ? AND status = 'completed' AND starts_at >= ? AND starts_at < ?`)
      .bind(shopId, dayStart - 6 * DAY, tomorrowStart),
    db
      .prepare(`SELECT COALESCE(SUM(price_pkr), 0) AS revenue FROM appointments WHERE shop_id = ? AND status = 'completed' AND starts_at >= ?`)
      .bind(shopId, dayStart - 29 * DAY),
    db.prepare(`SELECT COUNT(*) AS n FROM appointments WHERE shop_id = ? AND status = 'pending' AND starts_at >= ?`).bind(shopId, now()),
    db.prepare(`SELECT AVG(rating) AS rating, COUNT(*) AS n FROM reviews WHERE shop_id = ?`).bind(shopId),
    db.prepare(`SELECT COUNT(DISTINCT customer_sub) AS n FROM appointments WHERE shop_id = ? AND customer_sub NOT LIKE 'walkin:%'`).bind(shopId),
    db.prepare(`${APPOINTMENT_SELECT} WHERE a.shop_id = ? AND a.starts_at >= ? AND a.starts_at < ? AND a.status != 'cancelled' ORDER BY a.starts_at`).bind(shopId, dayStart, tomorrowStart),
    db.prepare(`${APPOINTMENT_SELECT} WHERE a.shop_id = ? AND a.status = 'pending' AND a.starts_at >= ? ORDER BY a.starts_at LIMIT 30`).bind(shopId, now()),
    db
      .prepare(`SELECT starts_at, price_pkr FROM appointments WHERE shop_id = ? AND status = 'completed' AND starts_at >= ?`)
      .bind(shopId, dayStart - 6 * DAY),
    db
      .prepare(
        `SELECT COALESCE(sv.name, 'Service') AS name, COUNT(*) AS n, COALESCE(SUM(a.price_pkr), 0) AS revenue
         FROM appointments a LEFT JOIN services sv ON sv.id = a.service_id
         WHERE a.shop_id = ? AND a.status = 'completed'
         GROUP BY a.service_id ORDER BY n DESC LIMIT 5`,
      )
      .bind(shopId),
  ])

  const revenueByDay = new Map<string, number>()
  for (const row of completed.results as { starts_at: number; price_pkr: number }[]) {
    const key = new Date(Number(row.starts_at) + 5 * 3_600_000).toISOString().slice(0, 10)
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(row.price_pkr))
  }
  const week = dateKeysBack(7)
  const review = reviewRow.results[0] as { rating: number | null; n: number } | undefined
  const todayStats = todayRow.results[0] as { n: number; revenue: number }

  return privateJson(c, {
    shop: mapShop(shop),
    stats: {
      todayBookings: Number(todayStats.n),
      todayRevenue: Number(todayStats.revenue),
      weekRevenue: Number((weekRow.results[0] as { revenue: number }).revenue),
      monthRevenue: Number((monthRow.results[0] as { revenue: number }).revenue),
      pending: Number((pendingRow.results[0] as { n: number }).n),
      rating: review?.rating === null || review?.rating === undefined ? null : Number(review.rating),
      reviewCount: Number(review?.n ?? 0),
      customers: Number((customerRow.results[0] as { n: number }).n),
    },
    today: (todayList.results as Row[]).map(mapAppointment),
    pending: (pendingList.results as Row[]).map(mapAppointment),
    weekSeries: week.map((key) => ({ label: dayLabel(key), value: revenueByDay.get(key) ?? 0 })),
    topServices: (topServices.results as { name: string; n: number; revenue: number }[]).map((row) => ({
      name: row.name,
      count: Number(row.n),
      revenue: Number(row.revenue),
    })),
  })
})

interface ShopInput {
  name?: string
  city?: string
  area?: string
  address?: string | null
  phone?: string | null
  description?: string | null
  opensAt?: string
  closesAt?: string
}

shopRoutes.post('/', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const existing = await ownedShop(db, user.sub)
  if (existing) return c.json({ error: 'You already have a shop.' }, 409)
  const body = await c.req.json<ShopInput>()
  const name = body.name?.trim().slice(0, 80)
  const city = body.city?.trim().slice(0, 60)
  const area = body.area?.trim().slice(0, 80)
  if (!name || !city || !area) return c.json({ error: 'Shop name, city and area are required.' }, 400)
  const opensAt = clockValue(body.opensAt, '10:00')
  const closesAt = clockValue(body.closesAt, '21:00')
  if (parseClock(closesAt, 1260) <= parseClock(opensAt, 600) + 30) return c.json({ error: 'Closing time must be after opening time.' }, 400)

  const shopId = id()
  const t = now()
  const profile = await ensureProfile(db, user)
  await db.batch([
    db
      .prepare(
        `INSERT INTO shops (id, owner_sub, name, city, area, address, phone, description, hue, opens_at, closes_at, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .bind(shopId, user.sub, name, city, area, body.address?.trim().slice(0, 160) || null, body.phone?.trim().slice(0, 40) || null, body.description?.trim().slice(0, 500) || null, hueFor(name), opensAt, closesAt, t, t),
    db
      .prepare(`INSERT INTO barbers (id, shop_id, name, title, phone, active, hue, created_at) VALUES (?, ?, ?, 'Master barber', ?, 1, ?, ?)`)
      .bind(id(), shopId, profile.name.slice(0, 60), profile.phone ?? null, hueFor(profile.name), t),
    ...STARTER_SERVICES.map(([serviceName, price, minutes], index) =>
      db
        .prepare(`INSERT INTO services (id, shop_id, name, price_pkr, duration_min, active, sort, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`)
        .bind(id(), shopId, serviceName, price, minutes, index, t),
    ),
  ])
  const row = await db.prepare(`${SHOP_SELECT} WHERE s.id = ?`).bind(shopId).first<Row>()
  return privateJson(c, { shop: mapShop(row as Row) }, 201)
})

const STARTER_SERVICES: [string, number, number][] = [
  ['Haircut', 800, 30],
  ['Beard Trim', 400, 20],
  ['Haircut + Beard', 1100, 45],
]

function clockValue(value: string | undefined, fallback: string): string {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return fallback
  const minutes = parseClock(value, 0)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

shopRoutes.patch('/', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const body = await c.req.json<ShopInput>()
  const opensAt = body.opensAt === undefined ? (shop.opens_at as string) : clockValue(body.opensAt, shop.opens_at as string)
  const closesAt = body.closesAt === undefined ? (shop.closes_at as string) : clockValue(body.closesAt, shop.closes_at as string)
  if (parseClock(closesAt, 1260) <= parseClock(opensAt, 600) + 30) return c.json({ error: 'Closing time must be after opening time.' }, 400)
  const name = (body.name ?? (shop.name as string)).trim().slice(0, 80)
  if (!name) return c.json({ error: 'Shop name is required.' }, 400)
  await db
    .prepare(
      `UPDATE shops SET name = ?, city = ?, area = ?, address = ?, phone = ?, description = ?, opens_at = ?, closes_at = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(
      name,
      (body.city ?? (shop.city as string)).trim().slice(0, 60),
      (body.area ?? (shop.area as string)).trim().slice(0, 80),
      body.address === undefined ? (shop.address as string | null) : (body.address ?? '').trim().slice(0, 160) || null,
      body.phone === undefined ? (shop.phone as string | null) : (body.phone ?? '').trim().slice(0, 40) || null,
      body.description === undefined ? (shop.description as string | null) : (body.description ?? '').trim().slice(0, 500) || null,
      opensAt,
      closesAt,
      now(),
      shop.id,
    )
    .run()
  const row = await db.prepare(`${SHOP_SELECT} WHERE s.id = ?`).bind(shop.id).first<Row>()
  return privateJson(c, { shop: mapShop(row as Row) })
})

shopRoutes.get('/availability', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const date = c.req.query('date') ?? ''
  const serviceId = c.req.query('serviceId') ?? ''
  const barberId = c.req.query('barberId')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: 'Pick a valid date.' }, 400)
  const service = await db
    .prepare(`SELECT id, duration_min FROM services WHERE id = ? AND shop_id = ?`)
    .bind(serviceId, shop.id)
    .first<{ id: string; duration_min: number }>()
  if (!service) return c.json({ error: 'Pick a service first.' }, 400)
  const result = await availability(
    db,
    shop as unknown as { id: string; opens_at: string; closes_at: string },
    date,
    Number(service.duration_min),
    barberId && barberId !== 'any' ? barberId : null,
  )
  return privateJson(c, result)
})

// Appointments ------------------------------------------------------------

shopRoutes.get('/appointments', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const date = c.req.query('date')
  const status = c.req.query('status')
  const where: string[] = ['a.shop_id = ?']
  const binds: unknown[] = [shop.id]
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    where.push('a.starts_at >= ? AND a.starts_at < ?')
    binds.push(pkStamp(date, 0), pkStamp(date, 0) + DAY)
  } else {
    where.push('a.starts_at >= ?')
    binds.push(pkStamp(todayKey(), 0))
  }
  if (status && STATUSES.has(status)) {
    where.push('a.status = ?')
    binds.push(status)
  }
  const rows = await db
    .prepare(`${APPOINTMENT_SELECT} WHERE ${where.join(' AND ')} ORDER BY a.starts_at LIMIT 200`)
    .bind(...binds)
    .all<Row>()
  return privateJson(c, { items: rows.results.map(mapAppointment) })
})

interface WalkInInput {
  serviceId?: string
  barberId?: string | null
  date?: string
  time?: string
  customerName?: string
  customerPhone?: string
  notes?: string | null
  status?: string
}

shopRoutes.post('/appointments', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const body = await c.req.json<WalkInInput>()
  const shopId = shop.id as string
  const date = body.date ?? ''
  const time = body.time ?? ''
  const name = body.customerName?.trim().slice(0, 80)
  if (!body.serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !name) {
    return c.json({ error: 'Customer name, service, date and time are required.' }, 400)
  }
  const service = await db
    .prepare(`SELECT id, duration_min, price_pkr FROM services WHERE id = ? AND shop_id = ? AND active = 1`)
    .bind(body.serviceId, shopId)
    .first<{ id: string; duration_min: number; price_pkr: number }>()
  if (!service) return c.json({ error: 'That service is not on your menu.' }, 400)

  const requested = body.barberId && body.barberId !== 'any' ? body.barberId : null
  if (requested) {
    const barber = await db.prepare(`SELECT id FROM barbers WHERE id = ? AND shop_id = ? AND active = 1`).bind(requested, shopId).first()
    if (!barber) return c.json({ error: 'That barber is not on your team.' }, 400)
  }
  const startsAt = pkStamp(date, parseClock(time, 0))
  const barberId = requested ?? (await freeBarber(db, shopId, startsAt, Number(service.duration_min)))
  if (!barberId) return c.json({ error: 'No barber is free at that time.' }, 409)
  const { slots } = await availability(db, shop as unknown as { id: string; opens_at: string; closes_at: string }, date, Number(service.duration_min), barberId)
  const slot = slots.find((entry) => entry.time === time)
  if (!slot || !slot.available) return c.json({ error: 'That slot is outside opening hours or already taken.' }, 409)

  const appointmentId = id()
  const t = now()
  try {
    await db
      .prepare(
        `INSERT INTO appointments (id, shop_id, barber_id, service_id, customer_sub, customer_name, customer_phone, starts_at, duration_min, price_pkr, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        appointmentId,
        shopId,
        barberId,
        service.id,
        `walkin:${shopId}`,
        name,
        body.customerPhone?.trim().slice(0, 40) || null,
        startsAt,
        Number(service.duration_min),
        Number(service.price_pkr),
        body.status === 'pending' ? 'pending' : 'confirmed',
        body.notes?.trim().slice(0, 500) || null,
        t,
        t,
      )
      .run()
  } catch (error) {
    console.error('walk-in insert failed', error)
    return c.json({ error: 'That barber already has a booking at that time.' }, 409)
  }
  const row = await db.prepare(`${APPOINTMENT_SELECT} WHERE a.id = ?`).bind(appointmentId).first<Row>()
  return privateJson(c, { appointment: mapAppointment(row as Row) }, 201)
})

shopRoutes.post('/appointments/:id/status', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const body = await c.req.json<{ status?: string }>()
  if (!body.status || !STATUSES.has(body.status)) return c.json({ error: 'Unknown status.' }, 400)
  const appointment = await db
    .prepare(`SELECT id, status FROM appointments WHERE id = ? AND shop_id = ?`)
    .bind(c.req.param('id'), shop.id)
    .first<{ id: string; status: string }>()
  if (!appointment) return c.json({ error: 'Booking not found.' }, 404)
  await db.prepare(`UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?`).bind(body.status, now(), appointment.id).run()
  return privateJson(c, { ok: true, status: body.status })
})

// Services ----------------------------------------------------------------

shopRoutes.get('/services', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const rows = await db.prepare(`SELECT * FROM services WHERE shop_id = ? ORDER BY active DESC, sort, price_pkr`).bind(shop.id).all<Row>()
  return privateJson(c, { items: rows.results.map(mapService) })
})

shopRoutes.post('/services', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const body = await c.req.json<{ name?: string; pricePkr?: number; durationMin?: number }>()
  const name = body.name?.trim().slice(0, 60)
  const price = Math.round(Number(body.pricePkr ?? 0))
  const duration = Math.round(Number(body.durationMin ?? 30))
  if (!name) return c.json({ error: 'Service name is required.' }, 400)
  if (!(price >= 0 && price <= 500_000)) return c.json({ error: 'Enter a price in rupees.' }, 400)
  if (!(duration >= 5 && duration <= 240)) return c.json({ error: 'Duration should be 5–240 minutes.' }, 400)
  const nextSort = await db.prepare(`SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM services WHERE shop_id = ?`).bind(shop.id).first<{ n: number }>()
  const serviceId = id()
  await db
    .prepare(`INSERT INTO services (id, shop_id, name, price_pkr, duration_min, active, sort, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`)
    .bind(serviceId, shop.id, name, price, duration, Number(nextSort?.n ?? 0), now())
    .run()
  const row = await db.prepare(`SELECT * FROM services WHERE id = ?`).bind(serviceId).first<Row>()
  return privateJson(c, { service: mapService(row as Row) }, 201)
})

shopRoutes.patch('/services/:id', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const existing = await db.prepare(`SELECT * FROM services WHERE id = ? AND shop_id = ?`).bind(c.req.param('id'), shop.id).first<Row>()
  if (!existing) return c.json({ error: 'Service not found.' }, 404)
  const body = await c.req.json<{ name?: string; pricePkr?: number; durationMin?: number; active?: boolean }>()
  const name = (body.name ?? (existing.name as string)).trim().slice(0, 60)
  const price = body.pricePkr === undefined ? Number(existing.price_pkr) : Math.round(Number(body.pricePkr))
  const duration = body.durationMin === undefined ? Number(existing.duration_min) : Math.round(Number(body.durationMin))
  if (!name) return c.json({ error: 'Service name is required.' }, 400)
  if (!(price >= 0 && price <= 500_000)) return c.json({ error: 'Enter a price in rupees.' }, 400)
  if (!(duration >= 5 && duration <= 240)) return c.json({ error: 'Duration should be 5–240 minutes.' }, 400)
  const active = body.active === undefined ? Boolean(existing.active) : body.active
  await db
    .prepare(`UPDATE services SET name = ?, price_pkr = ?, duration_min = ?, active = ? WHERE id = ? AND shop_id = ?`)
    .bind(name, price, duration, active ? 1 : 0, existing.id, shop.id)
    .run()
  const row = await db.prepare(`SELECT * FROM services WHERE id = ?`).bind(existing.id).first<Row>()
  return privateJson(c, { service: mapService(row as Row) })
})

shopRoutes.delete('/services/:id', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const serviceId = c.req.param('id')
  const used = await db.prepare(`SELECT COUNT(*) AS n FROM appointments WHERE service_id = ? AND shop_id = ?`).bind(serviceId, shop.id).first<{ n: number }>()
  if (Number(used?.n ?? 0) > 0) {
    await db.prepare(`UPDATE services SET active = 0 WHERE id = ? AND shop_id = ?`).bind(serviceId, shop.id).run()
  } else {
    await db.prepare(`DELETE FROM services WHERE id = ? AND shop_id = ?`).bind(serviceId, shop.id).run()
  }
  return privateJson(c, { ok: true })
})

// Team --------------------------------------------------------------------

shopRoutes.get('/barbers', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const rows = await db
    .prepare(
      `SELECT b.*,
        (SELECT COUNT(*) FROM appointments a WHERE a.barber_id = b.id AND a.status = 'completed') AS bookings
       FROM barbers b WHERE b.shop_id = ? ORDER BY b.active DESC, b.created_at`,
    )
    .bind(shop.id)
    .all<Row>()
  return privateJson(c, { items: rows.results.map(mapBarber) })
})

shopRoutes.post('/barbers', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const body = await c.req.json<{ name?: string; title?: string; phone?: string | null }>()
  const name = body.name?.trim().slice(0, 60)
  if (!name) return c.json({ error: 'Barber name is required.' }, 400)
  const barberId = id()
  await db
    .prepare(`INSERT INTO barbers (id, shop_id, name, title, phone, active, hue, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`)
    .bind(barberId, shop.id, name, body.title?.trim().slice(0, 40) || 'Barber', body.phone?.trim().slice(0, 40) || null, hueFor(name), now())
    .run()
  const row = await db.prepare(`SELECT *, 0 AS bookings FROM barbers WHERE id = ?`).bind(barberId).first<Row>()
  return privateJson(c, { barber: mapBarber(row as Row) }, 201)
})

shopRoutes.patch('/barbers/:id', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const existing = await db.prepare(`SELECT * FROM barbers WHERE id = ? AND shop_id = ?`).bind(c.req.param('id'), shop.id).first<Row>()
  if (!existing) return c.json({ error: 'Barber not found.' }, 404)
  const body = await c.req.json<{ name?: string; title?: string; phone?: string | null; active?: boolean }>()
  const name = (body.name ?? (existing.name as string)).trim().slice(0, 60)
  if (!name) return c.json({ error: 'Barber name is required.' }, 400)
  await db
    .prepare(`UPDATE barbers SET name = ?, title = ?, phone = ?, active = ? WHERE id = ? AND shop_id = ?`)
    .bind(
      name,
      (body.title ?? (existing.title as string)).trim().slice(0, 40) || 'Barber',
      body.phone === undefined ? existing.phone : (body.phone ?? '').trim().slice(0, 40) || null,
      body.active === undefined ? Number(existing.active) : body.active ? 1 : 0,
      existing.id,
      shop.id,
    )
    .run()
  const row = await db
    .prepare(
      `SELECT b.*, (SELECT COUNT(*) FROM appointments a WHERE a.barber_id = b.id AND a.status = 'completed') AS bookings FROM barbers b WHERE b.id = ?`,
    )
    .bind(existing.id)
    .first<Row>()
  return privateJson(c, { barber: mapBarber(row as Row) })
})

shopRoutes.delete('/barbers/:id', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const barberId = c.req.param('id')
  const used = await db.prepare(`SELECT COUNT(*) AS n FROM appointments WHERE barber_id = ? AND shop_id = ?`).bind(barberId, shop.id).first<{ n: number }>()
  if (Number(used?.n ?? 0) > 0) {
    await db.prepare(`UPDATE barbers SET active = 0 WHERE id = ? AND shop_id = ?`).bind(barberId, shop.id).run()
  } else {
    await db.prepare(`DELETE FROM barbers WHERE id = ? AND shop_id = ?`).bind(barberId, shop.id).run()
  }
  return privateJson(c, { ok: true })
})

shopRoutes.get('/reviews', async (c) => {
  const db = c.get('db')
  const shop = await loadShop(c)
  if (!shop) return c.json(SHOP_MISSING, 404)
  const rows = await db.prepare(`${REVIEW_SELECT} WHERE r.shop_id = ? ORDER BY r.created_at DESC LIMIT 100`).bind(shop.id).all<Row>()
  return privateJson(c, { items: rows.results.map(mapReview) })
})

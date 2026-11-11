import { Hono } from 'hono'

import { maybeUser, privateJson, requireAuth } from '../auth'
import {
  APPOINTMENT_SELECT,
  DAY,
  guestSub,
  guestToken,
  id,
  mapAppointment,
  now,
  parseClock,
  pkStamp,
  tokenLabel,
} from '../db'
import type { AppContext } from '../env'
import { ensureProfile } from '../roles'
import { availability, freeBarber } from '../slots'

export const bookings = new Hono<AppContext>()

bookings.get('/', requireAuth, async (c) => {
  const db = c.get('db')
  const sub = c.get('user').sub
  const rows = await db
    .prepare(`${APPOINTMENT_SELECT} WHERE a.customer_sub = ? ORDER BY a.starts_at DESC LIMIT 100`)
    .bind(sub)
    .all<Record<string, unknown>>()
  const items = rows.results.map(mapAppointment)
  const live = new Set(['pending', 'confirmed'])
  return privateJson(c, {
    upcoming: items
      .filter((item) => live.has(item.status) && item.startsAt >= now() - DAY)
      .sort((a, b) => a.startsAt - b.startsAt),
    past: items.filter((item) => !live.has(item.status) || item.startsAt < now() - DAY),
  })
})

interface BookingInput {
  shopId?: string
  serviceId?: string
  barberId?: string | null
  date?: string
  time?: string
  notes?: string | null
  customerName?: string
  customerPhone?: string
  customerEmail?: string
}

/** Digits only, so '0300 1234567' and '+92 300 1234567' both pass. */
const phoneDigits = (value: string) => value.replace(/[^\d]/g, '')

bookings.post('/', async (c) => {
  const db = c.get('db')
  const signedIn = maybeUser(c)
  const profile = signedIn ? await ensureProfile(db, signedIn) : null
  const body = await c.req.json<BookingInput>()

  const shopId = body.shopId ?? ''
  const serviceId = body.serviceId ?? ''
  const date = body.date ?? ''
  const time = body.time ?? ''
  if (!shopId || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return c.json({ error: 'Pick a service, date and time.' }, 400)
  }

  // Guests type their own details at checkout, like a delivery order.
  const rawName = (body.customerName ?? profile?.name ?? '').trim()
  const name = rawName.slice(0, 80)
  if (!signedIn && name.length < 2) return c.json({ error: 'Enter your name so the barber knows who is coming.' }, 400)

  const rawPhone = (body.customerPhone ?? profile?.phone ?? '').trim()
  const digits = phoneDigits(rawPhone)
  if (digits.length < 10 || digits.length > 13) {
    return c.json({ error: 'Enter a mobile number the shop can call, e.g. 0300 1234567.' }, 400)
  }
  const phone = rawPhone.slice(0, 40)
  const email = (body.customerEmail ?? profile?.email ?? '').trim().slice(0, 120) || null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'That email does not look right.' }, 400)

  const [shopRes, serviceRes, barberRes] = await db.batch([
    db.prepare(`SELECT id, opens_at, closes_at, status FROM shops WHERE id = ?`).bind(shopId),
    db.prepare(`SELECT id, duration_min, price_pkr FROM services WHERE id = ? AND shop_id = ? AND active = 1`).bind(serviceId, shopId),
    body.barberId && body.barberId !== 'any'
      ? db.prepare(`SELECT id FROM barbers WHERE id = ? AND shop_id = ? AND active = 1`).bind(body.barberId, shopId)
      : db.prepare(`SELECT NULL AS id`),
  ])
  const shop = shopRes.results[0] as { id: string; opens_at: string; closes_at: string; status: string } | undefined
  const service = serviceRes.results[0] as { id: string; duration_min: number; price_pkr: number } | undefined
  if (!shop || shop.status !== 'approved') return c.json({ error: 'This shop is not taking bookings right now.' }, 409)
  if (!service) return c.json({ error: 'That service is no longer available.' }, 409)
  if (body.barberId && body.barberId !== 'any' && !barberRes.results[0]) {
    return c.json({ error: 'That barber is no longer available.' }, 409)
  }

  const requested = body.barberId && body.barberId !== 'any' ? body.barberId : null
  const { slots } = await availability(db, shop, date, Number(service.duration_min), requested)
  const slot = slots.find((entry) => entry.time === time)
  if (!slot || !slot.available) return c.json({ error: 'That time has just been taken. Pick another slot.' }, 409)

  const barberId = requested ?? (await freeBarber(db, shopId, pkStamp(date, parseClock(time, 0)), Number(service.duration_min)))
  if (!barberId) return c.json({ error: 'No barber is free at that time.' }, 409)

  const appointmentId = id()
  const t = now()
  const token = signedIn ? null : guestToken()
  try {
    await db
      .prepare(
        `INSERT INTO appointments (id, shop_id, barber_id, service_id, customer_sub, customer_name, customer_phone, starts_at, duration_min, price_pkr, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      )
      .bind(
        appointmentId,
        shopId,
        barberId,
        serviceId,
        signedIn ? signedIn.sub : guestSub(token as string),
        name,
        phone,
        slot.startsAt,
        Number(service.duration_min),
        Number(service.price_pkr),
        body.notes?.trim().slice(0, 500) || null,
        t,
        t,
      )
      .run()
    if (token) {
      await db.prepare(`INSERT INTO guest_tokens (token, appointment_id, created_at) VALUES (?, ?, ?)`).bind(token, appointmentId, t).run()
    }
    if (email && profile && !profile.email) {
      await db.prepare(`UPDATE profiles SET email = ? WHERE sub = ?`).bind(email, signedIn!.sub).run()
    }
  } catch (error) {
    console.error('booking insert failed', error)
    return c.json({ error: 'That time has just been taken. Pick another slot.' }, 409)
  }

  const row = await db.prepare(`${APPOINTMENT_SELECT} WHERE a.id = ?`).bind(appointmentId).first<Record<string, unknown>>()
  return privateJson(
    c,
    {
      appointment: mapAppointment(row as Record<string, unknown>),
      guestToken: token,
      code: token ? tokenLabel(token) : null,
    },
    201,
  )
})

/**
 * Guests have no account, so the app keeps their codes on the device and trades
 * them for the live bookings here. Tokens are unguessable and only ever sent to
 * the browser that booked.
 */
bookings.post('/lookup', async (c) => {
  const db = c.get('db')
  const body = await c.req.json<{ tokens?: unknown }>()
  const tokens = Array.isArray(body.tokens)
    ? body.tokens.filter((value): value is string => typeof value === 'string').map((value) => value.trim().toUpperCase()).slice(0, 30)
    : []
  if (tokens.length === 0) return privateJson(c, { appointments: [] as unknown[] })

  const links = await db
    .prepare(`SELECT token, appointment_id FROM guest_tokens WHERE token IN (${tokens.map(() => '?').join(',')})`)
    .bind(...tokens)
    .all<{ token: string; appointment_id: string }>()
  const byId = new Map(links.results.map((row) => [row.appointment_id, row.token]))
  if (byId.size === 0) return privateJson(c, { appointments: [] as unknown[], missing: tokens })

  const rows = await db
    .prepare(`${APPOINTMENT_SELECT} WHERE a.id IN (${[...byId.keys()].map(() => '?').join(',')}) ORDER BY a.starts_at DESC`)
    .bind(...byId.keys())
    .all<Record<string, unknown>>()

  return privateJson(c, {
    appointments: rows.results.map((row) => {
      const appointment = mapAppointment(row)
      return { ...appointment, guestToken: byId.get(appointment.id) ?? null, code: tokenLabel(byId.get(appointment.id) ?? '') }
    }),
    missing: tokens.filter((token) => !links.results.some((row) => row.token === token)),
  })
})

bookings.post('/guest/:token/cancel', async (c) => {
  const db = c.get('db')
  const token = c.req.param('token').trim().toUpperCase()
  const link = await db.prepare(`SELECT appointment_id FROM guest_tokens WHERE token = ?`).bind(token).first<{ appointment_id: string }>()
  if (!link) return c.json({ error: 'That booking code is not valid.' }, 404)
  const appointment = await db
    .prepare(`SELECT id, status, starts_at FROM appointments WHERE id = ?`)
    .bind(link.appointment_id)
    .first<{ id: string; status: string; starts_at: number }>()
  if (!appointment) return c.json({ error: 'That booking no longer exists.' }, 404)
  if (appointment.status !== 'pending' && appointment.status !== 'confirmed') {
    return c.json({ error: 'This booking can no longer be cancelled.' }, 409)
  }
  if (Number(appointment.starts_at) < now()) return c.json({ error: 'This booking has already started.' }, 409)
  await db.prepare(`UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ?`).bind(now(), appointment.id).run()
  return privateJson(c, { ok: true })
})

bookings.post('/:id/cancel', requireAuth, async (c) => {
  const db = c.get('db')
  const sub = c.get('user').sub
  const appointment = await db
    .prepare(`SELECT * FROM appointments WHERE id = ? AND customer_sub = ?`)
    .bind(c.req.param('id'), sub)
    .first<{ id: string; status: string; starts_at: number }>()
  if (!appointment) return c.json({ error: 'Booking not found.' }, 404)
  if (appointment.status !== 'pending' && appointment.status !== 'confirmed') {
    return c.json({ error: 'This booking can no longer be cancelled.' }, 409)
  }
  if (Number(appointment.starts_at) < now()) return c.json({ error: 'This booking has already started.' }, 409)
  await db.prepare(`UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ?`).bind(now(), appointment.id).run()
  return privateJson(c, { ok: true })
})

bookings.post('/:id/review', requireAuth, async (c) => {
  const db = c.get('db')
  const sub = c.get('user').sub
  const body = await c.req.json<{ rating?: number; body?: string | null }>()
  const rating = Math.round(Number(body.rating ?? 0))
  if (!(rating >= 1 && rating <= 5)) return c.json({ error: 'Choose a rating from 1 to 5.' }, 400)

  const appointment = await db
    .prepare(`SELECT * FROM appointments WHERE id = ? AND customer_sub = ?`)
    .bind(c.req.param('id'), sub)
    .first<{ id: string; shop_id: string; status: string; customer_name: string; service_id: string | null }>()
  if (!appointment) return c.json({ error: 'Booking not found.' }, 404)
  if (appointment.status !== 'completed') return c.json({ error: 'You can review a visit once it is completed.' }, 409)

  const existing = await db.prepare(`SELECT id FROM reviews WHERE appointment_id = ?`).bind(appointment.id).first()
  if (existing) return c.json({ error: 'You have already reviewed this visit.' }, 409)

  await db
    .prepare(
      `INSERT INTO reviews (id, shop_id, appointment_id, customer_sub, customer_name, rating, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id(), appointment.shop_id, appointment.id, sub, appointment.customer_name, rating, body.body?.trim().slice(0, 600) || null, now())
    .run()
  return privateJson(c, { ok: true }, 201)
})

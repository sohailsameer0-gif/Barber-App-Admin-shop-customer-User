import type { Slot } from '../shared/types'
import { DAY, parseClock, pkClock, pkStamp } from './db'

interface ShopHours {
  id: string
  opens_at: string
  closes_at: string
}

const STEP = 30

/**
 * Open chairs for one Pakistan-calendar day. A slot is offered when the whole
 * service fits before closing time and at least one eligible barber is free.
 */
export async function availability(
  db: D1Database,
  shop: ShopHours,
  date: string,
  durationMin: number,
  barberId?: string | null,
): Promise<{ slots: Slot[]; closed: boolean }> {
  const openMin = parseClock(shop.opens_at, 600)
  const closeMin = parseClock(shop.closes_at, 1260)
  const duration = Math.max(5, Math.min(240, Math.round(durationMin || 30)))
  if (closeMin <= openMin + duration) return { slots: [], closed: true }

  const dayStart = pkStamp(date, 0)
  const [barbers, booked] = await db.batch([
    db.prepare(`SELECT id FROM barbers WHERE shop_id = ? AND active = 1`).bind(shop.id),
    db
      .prepare(
        `SELECT barber_id, starts_at, duration_min FROM appointments
         WHERE shop_id = ? AND status IN ('pending', 'confirmed') AND starts_at >= ? AND starts_at < ?`,
      )
      .bind(shop.id, dayStart, dayStart + DAY),
  ])

  const pool = (barbers.results as { id: string }[])
    .map((row) => row.id)
    .filter((candidateId) => !barberId || candidateId === barberId)
  if (pool.length === 0) return { slots: [], closed: false }

  const busy = new Map<string, { start: number; end: number }[]>()
  for (const row of booked.results as { barber_id: string | null; starts_at: number; duration_min: number }[]) {
    if (!row.barber_id) continue
    const list = busy.get(row.barber_id) ?? []
    list.push({ start: Number(row.starts_at), end: Number(row.starts_at) + Number(row.duration_min) * 60_000 })
    busy.set(row.barber_id, list)
  }

  const earliest = Date.now() + 10 * 60_000
  const slots: Slot[] = []
  for (let minute = openMin; minute + duration <= closeMin; minute += STEP) {
    const startsAt = pkStamp(date, minute)
    const endsAt = startsAt + duration * 60_000
    const free = pool.some((candidateId) =>
      (busy.get(candidateId) ?? []).every((window) => window.end <= startsAt || window.start >= endsAt),
    )
    slots.push({ time: pkClock(startsAt), startsAt, available: free && startsAt > earliest })
  }
  return { slots, closed: false }
}

/** Picks the first free barber for a slot, used for the "any barber" option. */
export async function freeBarber(db: D1Database, shopId: string, startsAt: number, durationMin: number) {
  const barbers = await db.prepare(`SELECT id FROM barbers WHERE shop_id = ? AND active = 1 ORDER BY created_at`).bind(shopId).all<{ id: string }>()
  const endsAt = startsAt + durationMin * 60_000
  const clash = await db
    .prepare(
      `SELECT DISTINCT barber_id FROM appointments
       WHERE shop_id = ? AND status IN ('pending', 'confirmed') AND barber_id IS NOT NULL
       AND starts_at < ? AND starts_at + duration_min * 60000 > ?`,
    )
    .bind(shopId, endsAt, startsAt)
    .all<{ barber_id: string }>()
  const taken = new Set((clash.results ?? []).map((row) => row.barber_id))
  return (barbers.results ?? []).map((row) => row.id).find((candidateId) => !taken.has(candidateId)) ?? null
}

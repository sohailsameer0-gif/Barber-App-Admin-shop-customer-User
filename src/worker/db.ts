import type { MiddlewareHandler } from 'hono'

import type { AppContext } from './env'

// Schema lives with the Worker: D1 has no migration tool on Freebuff Sites, so
// tables are created on the first request of each isolate (cheap: one batch of
// IF NOT EXISTS statements). Add new statements at the end for new columns or
// tables; never edit existing ones in place once deployed.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS profiles (
    sub TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    city TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    area TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    description TEXT,
    hue INTEGER NOT NULL DEFAULT 150,
    opens_at TEXT NOT NULL DEFAULT '10:00',
    closes_at TEXT NOT NULL DEFAULT '21:00',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS shops_owner ON shops(owner_sub)`,
  `CREATE INDEX IF NOT EXISTS shops_status ON shops(status, city)`,
  `CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price_pkr INTEGER NOT NULL DEFAULT 0,
    duration_min INTEGER NOT NULL DEFAULT 30,
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS services_shop ON services(shop_id, sort)`,
  `CREATE TABLE IF NOT EXISTS barbers (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Barber',
    phone TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    hue INTEGER NOT NULL DEFAULT 150,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS barbers_shop ON barbers(shop_id)`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    barber_id TEXT,
    service_id TEXT,
    customer_sub TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    starts_at INTEGER NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 30,
    price_pkr INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS appointments_customer ON appointments(customer_sub, starts_at DESC)`,
  `CREATE INDEX IF NOT EXISTS appointments_shop ON appointments(shop_id, starts_at)`,
  `CREATE INDEX IF NOT EXISTS appointments_barber ON appointments(barber_id, starts_at)`,
  // One chair, one customer: a barber cannot hold two live bookings at the same
  // minute. Cancelled / no-show rows drop out of the index, freeing the slot.
  `CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot ON appointments(barber_id, starts_at)
     WHERE status IN ('pending', 'confirmed') AND barber_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    appointment_id TEXT UNIQUE,
    customer_sub TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    body TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS reviews_shop ON reviews(shop_id, created_at DESC)`,
  // Guests book without an account: the token in their confirmation link is the
  // only way back into that booking, so it never appears in shop/admin payloads.
  `CREATE TABLE IF NOT EXISTS guest_tokens (
    token TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )`,
]

let ready: Promise<void> | undefined

export function ensureSchema(db: D1Database): Promise<void> {
  ready ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))).then(
    () => undefined,
    (error) => {
      ready = undefined
      throw error
    },
  )
  return ready
}

/** Rejects early with a clear message when the database binding is missing. */
export const requireDb: MiddlewareHandler<AppContext> = async (c, next) => {
  const db = c.env.DB
  if (!db) {
    return c.json(
      { error: 'database_missing', message: 'No database is attached yet. Add D1 storage named DB and redeploy.' },
      503,
    )
  }
  await ensureSchema(db)
  c.set('db', db)
  await next()
}

export const id = () => crypto.randomUUID()
export const now = () => Date.now()

// Crockford-ish alphabet: no 0/O/1/I/L so a guest can read the code off a
// screen and type it back without ambiguity.
const TOKEN_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** Short human-readable booking code used as a guest's key to their booking. */
export function guestToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join('')
}

/** 'AA BB CC DD' — easier to read aloud or copy from a screenshot. */
export const tokenLabel = (token: string) => (token.match(/.{1,4}/g) ?? []).join(' ')

/** Guests are stored as a synthetic subject so customer_sub stays NOT NULL. */
export const guestSub = (token: string) => `guest:${token}`
export const isGuestSub = (sub: string) => sub.startsWith('guest:')

export function hueFor(text: string): number {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

// Pakistan Standard Time is UTC+5 all year (no daylight saving), so plain
// arithmetic is exact and far cheaper than Intl on every row.
const PK_OFFSET = 5 * 60 * 60 * 1000
export const MINUTE = 60_000
export const DAY = 86_400_000

/** Epoch ms at which the Pakistan calendar day containing `ts` starts. */
export const pkDayStart = (ts: number) => Math.floor((ts + PK_OFFSET) / DAY) * DAY - PK_OFFSET
/** 'YYYY-MM-DD' on the Pakistan calendar. */
export const pkDateKey = (ts: number) => new Date(ts + PK_OFFSET).toISOString().slice(0, 10)
/** 'HH:MM' on the Pakistan calendar. */
export const pkClock = (ts: number) => new Date(ts + PK_OFFSET).toISOString().slice(11, 16)
/** Minutes since midnight on the Pakistan calendar. */
export function pkMinutes(ts: number): number {
  const d = new Date(ts + PK_OFFSET)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}
/** Epoch ms for a Pakistan-calendar date ('YYYY-MM-DD') and minute of day. */
export function pkStamp(dateKey: string, minutes: number): number {
  return Date.parse(`${dateKey}T00:00:00Z`) + minutes * MINUTE - PK_OFFSET
}
export const todayKey = () => pkDateKey(now())
export const dateKeysBack = (days: number, from = todayKey()): string[] => {
  const end = Date.parse(`${from}T00:00:00Z`)
  return Array.from({ length: days }, (_, i) => new Date(end - (days - 1 - i) * DAY).toISOString().slice(0, 10))
}
export const dayLabel = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export function parseClock(value: string | null | undefined, fallback: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? '').trim())
  if (!match) return fallback
  return Math.min(24 * 60, Number(match[1]) * 60 + Number(match[2]))
}

export const clockLabel = (value: string | null | undefined) => {
  const minutes = parseClock(value, 600)
  const h24 = Math.floor(minutes / 60) % 24
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(minutes % 60).padStart(2, '0')} ${suffix}`
}

type Row = Record<string, unknown>

export function mapShop(r: Row) {
  return {
    id: r.id as string,
    name: r.name as string,
    city: r.city as string,
    area: r.area as string,
    address: (r.address as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    hue: Number(r.hue ?? 150),
    opensAt: (r.opens_at as string) ?? '10:00',
    closesAt: (r.closes_at as string) ?? '21:00',
    status: r.status as 'pending' | 'approved' | 'suspended',
    rating: r.rating === null || r.rating === undefined ? null : Number(r.rating),
    reviewCount: Number(r.review_count ?? 0),
    priceFrom: r.price_from === null || r.price_from === undefined ? null : Number(r.price_from),
    barberCount: Number(r.barber_count ?? 0),
    serviceCount: Number(r.service_count ?? 0),
    createdAt: Number(r.created_at),
  }
}

export function mapService(r: Row) {
  return {
    id: r.id as string,
    shopId: r.shop_id as string,
    name: r.name as string,
    pricePkr: Number(r.price_pkr ?? 0),
    durationMin: Number(r.duration_min ?? 30),
    active: Boolean(r.active),
    sort: Number(r.sort ?? 0),
  }
}

export function mapBarber(r: Row) {
  return {
    id: r.id as string,
    shopId: r.shop_id as string,
    name: r.name as string,
    title: r.title as string,
    phone: (r.phone as string | null) ?? null,
    active: Boolean(r.active),
    hue: Number(r.hue ?? 150),
    rating: r.rating === null || r.rating === undefined ? null : Number(r.rating),
    bookings: Number(r.bookings ?? 0),
  }
}

export function mapAppointment(r: Row) {
  return {
    id: r.id as string,
    shopId: r.shop_id as string,
    shopName: (r.shop_name as string | null) ?? null,
    shopArea: (r.shop_area as string | null) ?? null,
    shopCity: (r.shop_city as string | null) ?? null,
    shopHue: r.shop_hue === null || r.shop_hue === undefined ? null : Number(r.shop_hue),
    barberId: (r.barber_id as string | null) ?? null,
    barberName: (r.barber_name as string | null) ?? null,
    serviceId: (r.service_id as string | null) ?? null,
    serviceName: (r.service_name as string | null) ?? null,
    customerSub: r.customer_sub as string,
    customerName: r.customer_name as string,
    customerPhone: (r.customer_phone as string | null) ?? null,
    startsAt: Number(r.starts_at),
    durationMin: Number(r.duration_min ?? 30),
    pricePkr: Number(r.price_pkr ?? 0),
    status: r.status as 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show',
    notes: (r.notes as string | null) ?? null,
    reviewed: Boolean(r.reviewed),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  }
}

export function mapReview(r: Row) {
  return {
    id: r.id as string,
    shopId: r.shop_id as string,
    customerName: r.customer_name as string,
    rating: Number(r.rating ?? 0),
    body: (r.body as string | null) ?? null,
    createdAt: Number(r.created_at),
    serviceName: (r.service_name as string | null) ?? null,
  }
}

export const SHOP_SELECT = `
  SELECT s.*,
    (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.shop_id = s.id) AS rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.shop_id = s.id) AS review_count,
    (SELECT MIN(sv.price_pkr) FROM services sv WHERE sv.shop_id = s.id AND sv.active = 1) AS price_from,
    (SELECT COUNT(*) FROM barbers b WHERE b.shop_id = s.id AND b.active = 1) AS barber_count,
    (SELECT COUNT(*) FROM services sv WHERE sv.shop_id = s.id AND sv.active = 1) AS service_count
  FROM shops s`

export const APPOINTMENT_SELECT = `
  SELECT a.*, s.name AS shop_name, s.area AS shop_area, s.city AS shop_city, s.hue AS shop_hue,
    b.name AS barber_name, sv.name AS service_name,
    CASE WHEN rv.id IS NULL THEN 0 ELSE 1 END AS reviewed
  FROM appointments a
  JOIN shops s ON s.id = a.shop_id
  LEFT JOIN barbers b ON b.id = a.barber_id
  LEFT JOIN services sv ON sv.id = a.service_id
  LEFT JOIN reviews rv ON rv.appointment_id = a.id`

export const REVIEW_SELECT = `
  SELECT r.*, sv.name AS service_name
  FROM reviews r
  LEFT JOIN appointments a ON a.id = r.appointment_id
  LEFT JOIN services sv ON sv.id = a.service_id`

import type { FreebuffUser } from '@freebuff/auth'

import { DEV_USER } from './auth'
import { hueFor, id, now, SHOP_SELECT } from './db'
import type { Env } from './env'

export interface ProfileRow {
  sub: string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  is_admin: number
  created_at: number
}

/** Reads the platform profile, creating it on first sign-in. */
export async function ensureProfile(db: D1Database, user: FreebuffUser): Promise<ProfileRow> {
  const existing = await db.prepare(`SELECT * FROM profiles WHERE sub = ?`).bind(user.sub).first<ProfileRow>()
  if (existing) return existing
  const name = (user.name ?? user.email?.split('@')[0] ?? 'Guest').slice(0, 80)
  await db
    .prepare(`INSERT OR IGNORE INTO profiles (sub, name, email, is_admin, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(user.sub, name, user.email ?? null, user.sub === DEV_USER.sub ? 1 : 0, now())
    .run()
  return (
    (await db.prepare(`SELECT * FROM profiles WHERE sub = ?`).bind(user.sub).first<ProfileRow>()) ?? {
      sub: user.sub,
      name,
      email: user.email ?? null,
      phone: null,
      city: null,
      is_admin: user.sub === DEV_USER.sub ? 1 : 0,
      created_at: now(),
    }
  )
}

/**
 * Admin access: either the profile flag or an email listed in ADMIN_EMAILS.
 * The env list is checked on every request so the deploy owner can grant
 * themselves the console with a secret, without a migration.
 */
export function isAdminUser(env: Env, profile: ProfileRow): boolean {
  if (profile.is_admin) return true
  if (!profile.email) return false
  const allowed = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(profile.email.toLowerCase())
}

/** The shop this account owns, or null while onboarding. */
export async function ownedShop(db: D1Database, sub: string) {
  const row = await db
    .prepare(`${SHOP_SELECT} WHERE s.owner_sub = ? ORDER BY s.created_at LIMIT 1`)
    .bind(sub)
    .first<Record<string, unknown>>()
  return row ?? null
}

/** A profile row for someone who has never signed in (seeded demo people). */
export async function ensureSeededProfile(db: D1Database, sub: string, name: string, email: string | null) {
  await db
    .prepare(`INSERT OR IGNORE INTO profiles (sub, name, email, is_admin, created_at) VALUES (?, ?, ?, 0, ?)`)
    .bind(sub, name, email, now())
    .run()
}

export function newShopId(name: string) {
  return `shop_${hueFor(name)}_${id().slice(0, 8)}`
}

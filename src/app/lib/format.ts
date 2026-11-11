export const PK_TZ = 'Asia/Karachi'

const rupees = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 })

/** Pakistani rupees, the way prices are written on a salon board. */
export function money(value: number): string {
  return `Rs ${rupees.format(Math.round(Number.isFinite(value) ? value : 0))}`
}

/** Short form for chart axes and bars. */
export function moneyCompact(value: number): string {
  if (value >= 100_000) return `Rs ${(value / 100_000).toFixed(value >= 1_000_000 ? 1 : 2)} lac`
  if (value >= 10_000) return `Rs ${Math.round(value / 1000)}k`
  return money(value)
}

const dateKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: PK_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** 'YYYY-MM-DD' on the Pakistan calendar. */
export const dateKeyOf = (ts: number) => dateKeyFormat.format(new Date(ts))

export const todayKey = () => dateKeyOf(Date.now())

export function shiftDateKey(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

export function dayLabel(ts: number): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: PK_TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(ts))
}

export function fullDay(ts: number): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: PK_TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ts))
}

export function dayKeyLabel(key: string): string {
  if (key === todayKey()) return 'Today'
  if (key === shiftDateKey(todayKey(), 1)) return 'Tomorrow'
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${key}T12:00:00Z`))
}

export function timeLabel(ts: number): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: PK_TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ts))
}

/** '14:30' → '2:30 PM' */
export function clockLabel(value: string | null | undefined): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? '').trim())
  if (!match) return ''
  const hours = Number(match[1]) % 24
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const twelve = hours % 12 === 0 ? 12 : hours % 12
  return `${twelve}:${match[2]} ${suffix}`
}

export function relativeTime(ts: number, now = Date.now()): string {
  const diff = now - ts
  const minutes = Math.round(diff / 60_000)
  if (Math.abs(minutes) < 1) return 'just now'
  if (Math.abs(minutes) < 60) return minutes > 0 ? `${minutes}m ago` : `in ${-minutes}m`
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return hours > 0 ? `${hours}h ago` : `in ${-hours}h`
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 7) return days > 0 ? `${days}d ago` : `in ${-days}d`
  return dayLabel(ts)
}

export function joinedLabel(ts: number): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: PK_TZ, month: 'short', year: 'numeric' }).format(new Date(ts))
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

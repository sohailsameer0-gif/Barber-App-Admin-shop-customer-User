import type { Appointment } from '../../shared/types'

// Guests have no account, so their booking codes live on this device. Losing
// them means losing the booking, which the confirmation screen says plainly.
const KEY = 'ustaad.guest-codes'

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function write(tokens: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(tokens.slice(-40)))
  } catch {
    /* private mode: the booking still works, only the device copy is lost */
  }
}

export const loadGuestCodes = () => read()

export function rememberGuestCode(code: string) {
  const tokens = read()
  if (!tokens.includes(code)) write([...tokens, code])
}

export function forgetGuestCode(code: string) {
  write(read().filter((token) => token !== code))
}

export const isLive = (appointment: Appointment) => appointment.status === 'pending' || appointment.status === 'confirmed'

/** Guests see the same shape as signed-in customers, split the same way. */
export function splitGuestBookings(items: Appointment[]) {
  const live = items.filter((item) => isLive(item) && item.startsAt >= Date.now() - 86_400_000).sort((a, b) => a.startsAt - b.startsAt)
  const past = items.filter((item) => !isLive(item) || item.startsAt < Date.now() - 86_400_000).sort((a, b) => b.startsAt - a.startsAt)
  return { upcoming: live, past }
}

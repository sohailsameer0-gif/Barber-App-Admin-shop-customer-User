import { motion } from 'motion/react'
import { CalendarCheck, Database, MapPin, Scissors, Star } from 'lucide-react'

import { Avatar, Badge } from '../components/ui'

// Shown when /api/me returns 401. Sign-in is a plain link to the SDK route; the
// Worker (not this page) decides who is signed in.
export function SignIn() {
  const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
  return (
    <div className="grid h-full lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8 sm:p-12">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-[11px] bg-[#173d33] text-[#f3e7cf]">
            <Scissors className="size-5 -rotate-45" />
          </span>
          <span>
            <span className="block text-[16px] font-semibold tracking-[-0.02em]">Ustaad</span>
            <span className="block text-[10.5px] uppercase tracking-[0.16em] text-faint">Barber booking · Pakistan</span>
          </span>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="max-w-md">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#a8813f]">For shop owners</p>
          <h1 className="mt-3 text-balance text-[36px] font-semibold leading-[1.06] tracking-[-0.03em]">
            Sign in to run your shop.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Take appointments, manage your team and prices, and keep your chairs full. Customers do not need an account to book —
            they just leave a name and a mobile number.
          </p>
          <a
            href={`/auth/freebuff/signin?returnTo=${returnTo}`}
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-control bg-fg px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#26262c]"
          >
            <span className="grid size-5 place-items-center rounded-[6px] bg-white text-[11px] font-bold text-fg">F</span>
            Sign in with Freebuff
          </a>
          <p className="mt-4 text-[12.5px] text-faint">
            Shop owners and admins sign in here. Everyone else can keep browsing and booking as a guest.
          </p>
          <a href="/" className="mt-3 inline-block text-[13px] font-medium text-fg underline decoration-line-strong underline-offset-4">
            Continue without signing in
          </a>
        </motion.div>

        <p className="text-[12.5px] text-faint">© {new Date().getFullYear()} Ustaad · Made for Pakistan</p>
      </div>

      <div className="relative hidden overflow-hidden bg-[#f4f1ea] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_75%_20%,rgb(23_61_51/0.18),transparent),radial-gradient(50%_50%_at_15%_85%,rgb(168_129_63/0.22),transparent)]" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-12 top-1/2 w-[560px] -translate-y-1/2 rounded-card bg-surface p-5 shadow-dialog"
        >
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold">Today in Gulberg</p>
            <Badge tone="success" dot>
              Confirmed
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              ['Chairs', '12', 'text-fg'],
              ['Earned', 'Rs 9,400', 'text-[#173d33]'],
              ['No-shows', '0', 'text-fg'],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-[14px] bg-bg p-3">
                <p className="text-[12px] text-muted">{label}</p>
                <p className={`mt-1 text-[18px] font-semibold tracking-tight ${tone}`}>{value}</p>
              </div>
            ))}
          </div>
          <ul className="mt-4 divide-y divide-line">
            {[
              ['Ahmed Raza', 'Haircut + Beard', '6:30 PM', 158, 'Rs 1,100'],
              ['Usman Tariq', 'Skin Fade', '7:00 PM', 212, 'Rs 1,200'],
              ['Zain Ali', 'Beard Trim', '7:30 PM', 22, 'Rs 400'],
            ].map(([name, service, time, hue, price]) => (
              <li key={name as string} className="flex items-center gap-3 py-2.5">
                <Avatar name={name as string} hue={hue as number} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{name}</span>
                  <span className="block truncate text-[12px] text-faint">{service}</span>
                </span>
                <span className="text-[12px] text-muted tabular-nums">{time}</span>
                <span className="text-[12.5px] font-medium tabular-nums">{price}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <div className="absolute bottom-14 left-12 flex flex-wrap gap-2 text-[12px] text-[#173d33]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 backdrop-blur">
            <MapPin className="size-3.5" /> 12 cities
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 backdrop-blur">
            <CalendarCheck className="size-3.5" /> Live availability
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 backdrop-blur">
            <Star className="size-3.5 fill-[#e0a12b] text-[#e0a12b]" /> Verified reviews
          </span>
        </div>
      </div>
    </div>
  )
}

export function SetupNeeded({ message }: { message: string }) {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-card bg-surface-2 text-muted">
          <Database className="size-5" />
        </div>
        <h1 className="mt-4 text-[20px] font-semibold tracking-tight">Almost there</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{message}</p>
        <p className="mt-4 text-[13px] text-faint">In Freebuff, ask the agent to add a D1 database named DB, then deploy again.</p>
      </div>
    </div>
  )
}

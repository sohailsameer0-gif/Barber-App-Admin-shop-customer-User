import {
  CalendarDays,
  LayoutGrid,
  LogIn,
  ListChecks,
  Menu as MenuIcon,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'

import { useMe } from '../lib/api'
import { cx } from '../lib/cx'
import { Avatar } from './ui'

const customerLinks = [
  { to: '/', label: 'Discover shops', icon: LayoutGrid, end: true },
  { to: '/bookings', label: 'My bookings', icon: CalendarDays },
]

const shopLinks = [
  { to: '/shop', label: 'Today', icon: Sparkles, end: true },
  { to: '/shop/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/shop/services', label: 'Services & prices', icon: ListChecks },
  { to: '/shop/team', label: 'Team', icon: Users },
  { to: '/shop/settings', label: 'Shop settings', icon: Store },
]

const adminLinks = [
  { to: '/admin', label: 'Platform', icon: ShieldCheck, end: true },
  { to: '/admin/shops', label: 'Shops', icon: Store },
  { to: '/admin/users', label: 'People', icon: Users },
]

function NavItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof LayoutGrid; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          'flex h-9 items-center gap-2.5 rounded-control px-2.5 text-[13.5px] font-medium transition-colors',
          isActive ? 'bg-surface text-fg shadow-card' : 'text-muted hover:bg-raised/60 hover:text-fg',
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  )
}

export function Shell() {
  const { data: me } = useMe()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const signedIn = Boolean(me?.user)
  const mode = location.pathname.startsWith('/shop') ? 'shop' : location.pathname.startsWith('/admin') ? 'admin' : 'customer'
  const links = mode === 'shop' ? shopLinks : mode === 'admin' ? adminLinks : customerLinks

  useEffect(() => setMobileOpen(false), [location.pathname])

  // Guests only get the customer half; the switch appears once you sign in.
  const segments = [
    { key: 'customer', to: '/', label: 'Customer', show: true },
    { key: 'shop', to: '/shop', label: me?.shop ? 'My shop' : 'Open a shop', show: signedIn },
    { key: 'admin', to: '/admin', label: 'Admin', show: Boolean(me?.profile?.isAdmin) },
  ].filter((segment) => segment.show)

  const sidebar = (
    <div className="flex h-full flex-col px-3 py-3">
      <NavLink to="/" className="flex h-10 items-center gap-2.5 px-2">
        <span className="grid size-8 place-items-center rounded-[10px] bg-[#173d33] text-[#f3e7cf]">
          <Scissors className="size-4.5 -rotate-45" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold tracking-[-0.02em]">Ustaad</span>
          <span className="block truncate text-[10.5px] uppercase tracking-[0.14em] text-faint">Barber booking · PK</span>
        </span>
      </NavLink>

      <div className={cx('mt-4 flex rounded-control bg-surface-2 p-1', segments.length < 2 && 'hidden')}>
        {segments.map((segment) => (
          <NavLink
            key={segment.key}
            to={segment.to}
            className={cx(
              'flex h-7 flex-1 items-center justify-center rounded-[9px] px-1 text-[12px] font-medium transition-colors',
              mode === segment.key ? 'bg-surface text-fg shadow-[0_1px_2px_rgb(20_20_24/0.08)]' : 'text-muted hover:text-fg',
            )}
          >
            {segment.label}
          </NavLink>
        ))}
      </div>

      <nav className="mt-4 flex flex-col gap-0.5">
        {links.map((link) => (
          <NavItem key={link.to} {...link} />
        ))}
      </nav>

      {mode === 'shop' && me?.shop && me.shop.status !== 'approved' && (
        <div className="mt-4 rounded-control border border-warning/30 bg-warning-soft px-2.5 py-2 text-[11.5px] leading-snug text-warning">
          {me.shop.status === 'pending' ? 'Awaiting admin approval — customers cannot book yet.' : 'Suspended by the platform. Fix the issue and contact support.'}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-0.5">
        {signedIn && me?.profile ? (
          <>
            <NavItem to="/settings" label="Account" icon={Settings} />
            <NavLink to="/settings" className="mt-1 flex items-center gap-2.5 rounded-control px-2 py-2 transition-colors hover:bg-raised/60">
              <Avatar name={me.profile.name || me.user?.email || 'You'} hue={158} src={me.user?.picture} size={28} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{me.profile.name || 'Signed in'}</span>
                <span className="block truncate text-[11.5px] text-faint">
                  {me.profile.isAdmin ? 'Admin' : me.shop ? (me.shop.status === 'approved' ? 'Shop owner' : 'Shop pending') : 'Customer'}
                </span>
              </span>
            </NavLink>
          </>
        ) : (
          <>
            <div className="mb-1 rounded-control bg-surface-2 px-2.5 py-2 text-[11.5px] leading-snug text-muted">
              Booking as a guest — no account needed.
            </div>
            <NavLink
              to="/signin"
              className="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-[13.5px] font-medium text-muted transition-colors hover:bg-raised/60 hover:text-fg"
            >
              <LogIn className="size-4" /> Shop owner sign in
            </NavLink>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-full">
      <aside className="hidden w-[236px] shrink-0 lg:block">{sidebar}</aside>

      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b border-line bg-bg/90 px-3 backdrop-blur lg:hidden">
        <button type="button" aria-label="Open menu" onClick={() => setMobileOpen(true)} className="grid size-9 place-items-center rounded-control">
          <MenuIcon className="size-5" />
        </button>
        <span className="text-[14px] font-semibold tracking-tight">Ustaad</span>
        <NavLink to={signedIn ? '/settings' : '/signin'} aria-label="Account" className="grid size-9 place-items-center rounded-control">
          <Avatar name={me?.profile?.name ?? 'Guest'} hue={158} src={me?.user?.picture} size={26} />
        </NavLink>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-fg/25" />
          <aside className="absolute inset-y-0 left-0 w-[286px] bg-bg shadow-dialog" onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-control">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 pt-12 lg:p-2 lg:pl-0 lg:pt-2">
        <div className="scrollbar-thin h-full overflow-y-auto bg-bg lg:rounded-card lg:border lg:border-line">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

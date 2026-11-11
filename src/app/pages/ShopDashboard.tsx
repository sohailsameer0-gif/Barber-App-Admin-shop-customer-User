import { ArrowRight, Ban, CalendarDays, Check, Clock, Plus, ShieldCheck, Star, Store, TrendingUp, Users, Wallet, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'react-router'

import { CITIES, type Appointment, type AppointmentStatus } from '../../shared/types'
import { AreaChart } from '../components/charts'
import { StatusBadge } from '../components/shop'
import { Avatar, Badge, Button, Card, Field, Input, PageHeader, Select, Skeleton, Textarea, useToast } from '../components/ui'
import { api, ApiError, useApiMutation, useMe, useShopDashboard } from '../lib/api'
import { cx } from '../lib/cx'
import { clockLabel, money, moneyCompact, timeLabel } from '../lib/format'

export function ShopDashboard() {
  const { data: me } = useMe()
  const hasShop = Boolean(me?.shop)
  const { data, isLoading, error } = useShopDashboard(hasShop)

  if (!me) return null
  if (!hasShop) return <ShopOnboarding />
  if (error instanceof ApiError && error.code === 'shop_missing') return <ShopOnboarding />
  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-[1180px] space-y-3 p-5 sm:p-8">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[104px] rounded-card" />
          ))}
        </div>
        <Skeleton className="h-[280px] rounded-card" />
      </div>
    )
  }

  const { shop, stats, today, pending, weekSeries, topServices } = data

  return (
    <div className="mx-auto max-w-[1180px] p-5 sm:p-8">
      <PageHeader
        title={shop.name}
        subtitle={`${shop.area}, ${shop.city} · ${clockLabel(shop.opensAt)} – ${clockLabel(shop.closesAt)}`}
        actions={
          <>
            <Link to="/shop/appointments" className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3.5 text-[13px] font-medium hover:bg-surface-2">
              <CalendarDays className="size-4" /> All appointments
            </Link>
            <Link to="/shop/appointments?add=1" className="inline-flex h-9 items-center gap-1.5 rounded-control bg-fg px-3.5 text-[13px] font-medium text-white hover:bg-[#26262c]">
              <Plus className="size-4" /> Walk-in
            </Link>
          </>
        }
      />

      {shop.status !== 'approved' && (
        <div
          className={cx(
            'mt-4 flex items-start gap-3 rounded-card border px-4 py-3 text-[13px]',
            shop.status === 'pending' ? 'border-warning/30 bg-warning-soft text-warning' : 'border-danger/30 bg-danger-soft text-danger',
          )}
        >
          {shop.status === 'pending' ? <ShieldCheck className="mt-0.5 size-4 shrink-0" /> : <Ban className="mt-0.5 size-4 shrink-0" />}
          <div>
            <p className="font-medium">
              {shop.status === 'pending' ? 'Your shop is awaiting approval' : 'Your shop is suspended'}
            </p>
            <p className="mt-0.5 leading-relaxed opacity-90">
              {shop.status === 'pending'
                ? 'Customers cannot see or book your shop yet. You can set up services and your team while the platform team reviews it.'
                : 'Customers cannot book your shop. Reply to the platform team to get it restored.'}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Bookings today" value={String(stats.todayBookings)} hint={`${pending.length} awaiting confirmation`} icon={<CalendarDays />} />
        <Kpi label="Collected today" value={money(stats.todayRevenue)} hint="Completed visits only" icon={<Wallet />} />
        <Kpi label="Last 7 days" value={money(stats.weekRevenue)} hint={`30 days: ${moneyCompact(stats.monthRevenue)}`} icon={<TrendingUp />} />
        <Kpi
          label="Shop rating"
          value={stats.rating === null ? 'New' : stats.rating.toFixed(1)}
          hint={`${stats.reviewCount} reviews · ${stats.customers} customers`}
          icon={<Star />}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold">Revenue this week</h2>
            <span className="text-[12px] text-faint">Completed visits, PKR</span>
          </div>
          <div className="mt-4">
            <AreaChart data={weekSeries} height={190} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Most booked</h2>
          <p className="mt-0.5 text-[12px] text-faint">All-time completed visits</p>
          <ul className="mt-4 space-y-3">
            {topServices.map((service) => (
              <li key={service.name}>
                <div className="flex items-baseline justify-between text-[12.5px]">
                  <span className="truncate font-medium">{service.name}</span>
                  <span className="shrink-0 text-muted tabular-nums">
                    {service.count} · {money(service.revenue)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-[#173d33]"
                    style={{ width: `${Math.max(6, (service.count / Math.max(1, topServices[0]?.count ?? 1)) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
            {topServices.length === 0 && <li className="py-4 text-center text-[12.5px] text-muted">No completed visits yet.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold">Today’s chairs</h2>
            <span className="text-[12px] text-faint">Asia/Karachi</span>
          </div>
          <Schedule items={today} empty="Nothing booked for today. Walk-ins can still be added." />
        </Card>

        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold">Needs a reply</h2>
            <Badge tone={pending.length ? 'warning' : 'neutral'}>{pending.length}</Badge>
          </div>
          <Schedule items={pending} empty="No pending requests. All caught up." compact />
        </Card>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <QuickLink to="/shop/services" icon={<Store />} title="Services & prices" detail="Set rupee prices and durations" />
        <QuickLink to="/shop/team" icon={<Users />} title="Team" detail="Add or pause barbers" />
        <QuickLink to="/shop/settings" icon={<Clock />} title="Opening hours" detail="Update timings and address" />
      </div>
    </div>
  )
}

function Kpi({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return (
    <Card className="flex h-[112px] flex-col justify-between p-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-muted">{label}</p>
        <span className="text-faint [&_svg]:size-4">{icon}</span>
      </div>
      <div>
        <p className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-faint">{hint}</p>
      </div>
    </Card>
  )
}

function QuickLink({ to, icon, title, detail }: { to: string; icon: ReactNode; title: string; detail: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong">
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-bg text-[#173d33] [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium">{title}</span>
        <span className="block truncate text-[12px] text-faint">{detail}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

function Schedule({ items, empty, compact }: { items: Appointment[]; empty: string; compact?: boolean }) {
  const toast = useToast()
  const setStatus = useApiMutation(
    (input: { id: string; status: AppointmentStatus }) => api(`/shop/appointments/${input.id}/status`, { method: 'POST', json: { status: input.status } }),
    ['shop-dashboard', 'shop-appointments', 'bookings'],
    { onSuccess: (_result, input) => toast(`Booking marked ${input.status.replace('_', ' ')}`) },
  )

  return (
    <ul className="mt-3 divide-y divide-line">
      {items.slice(0, compact ? 5 : 12).map((appointment) => (
        <li key={appointment.id} className="flex items-start gap-2.5 py-3">
          <span className="w-[58px] shrink-0 pt-0.5 text-[12.5px] font-medium tabular-nums text-muted">
            {timeLabel(appointment.startsAt)}
          </span>
          <Avatar name={appointment.customerName} hue={appointment.shopHue ?? 158} size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{appointment.customerName}</p>
            <p className="truncate text-[11.5px] text-faint">
              {appointment.serviceName ?? 'Service'} · {appointment.barberName ?? 'Any barber'}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] font-medium tabular-nums">{money(appointment.pricePkr)}</span>
              <StatusBadge status={appointment.status} />
              {appointment.status === 'pending' && (
                <span className="flex gap-1">
                  <Button size="icon-sm" variant="primary" aria-label="Confirm" onClick={() => setStatus.mutate({ id: appointment.id, status: 'confirmed' })}>
                    <Check />
                  </Button>
                  <Button size="icon-sm" aria-label="Cancel" onClick={() => setStatus.mutate({ id: appointment.id, status: 'cancelled' })}>
                    <X />
                  </Button>
                </span>
              )}
              {appointment.status === 'confirmed' && (
                <Button size="sm" onClick={() => setStatus.mutate({ id: appointment.id, status: 'completed' })}>
                  Complete
                </Button>
              )}
            </div>
          </div>
        </li>
      ))}
      {items.length === 0 && <li className="py-8 text-center text-[12.5px] text-muted">{empty}</li>}
    </ul>
  )
}

function ShopOnboarding() {
  const toast = useToast()
  const [name, setName] = useState('')
  const [city, setCity] = useState<string>('Lahore')
  const [area, setArea] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [description, setDescription] = useState('')
  const [opensAt, setOpensAt] = useState('10:00')
  const [closesAt, setClosesAt] = useState('21:00')
  const [error, setError] = useState<string | null>(null)

  const create = useApiMutation(
    () => api('/shop', { method: 'POST', json: { name, city, area, address, phone, description, opensAt, closesAt } }),
    ['me', 'shop-dashboard', 'shops'],
    {
      onSuccess: () => toast('Shop submitted — approval usually takes a few hours'),
      onError: (mutationError) => {
        const message = mutationError instanceof ApiError ? mutationError.message : 'Could not create the shop.'
        setError(message)
        toast(message, 'danger')
      },
    },
  )

  return (
    <div className="mx-auto max-w-[760px] p-5 sm:p-8">
      <PageHeader
        title="Open your shop on Ustaad"
        subtitle="List your barbershop, take bookings and get paid at the chair. Free to join — we take a small cut of completed visits."
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ['1', 'Add your shop', 'Name, area and opening hours.'],
          ['2', 'Set your menu', 'Rupee prices and how long each service takes.'],
          ['3', 'Get approved', 'Admin reviews it, then customers can book.'],
        ].map(([step, title, detail]) => (
          <div key={step} className="rounded-card border border-line bg-surface p-4">
            <span className="grid size-7 place-items-center rounded-full bg-[#173d33] text-[12px] font-semibold text-white">{step}</span>
            <p className="mt-2.5 text-[13.5px] font-medium">{title}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{detail}</p>
          </div>
        ))}
      </div>

      <Card className="mt-3 p-5">
        <h2 className="text-[14px] font-semibold">Shop details</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Shop name" className="sm:col-span-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ustaad Studio" maxLength={80} />
          </Field>
          <Field label="City">
            <Select value={city} onChange={(event) => setCity(event.target.value)}>
              {CITIES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Area" hint="e.g. Gulberg III, Clifton Block 5, F-7 Markaz">
            <Input value={area} onChange={(event) => setArea(event.target.value)} maxLength={80} />
          </Field>
          <Field label="Full address" className="sm:col-span-2">
            <Input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={160} placeholder="Shop number, street, landmark" />
          </Field>
          <Field label="Shop mobile">
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0300 1234567" inputMode="tel" maxLength={40} />
          </Field>
          <Field label="Opening time">
            <Input type="time" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} />
          </Field>
          <Field label="Closing time">
            <Input type="time" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} />
          </Field>
          <Field label="About the shop" className="sm:col-span-2">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What makes your shop worth the visit? AC, hot towel shave, home service…"
              maxLength={500}
            />
          </Field>
        </div>

        {error && <p className="mt-3 rounded-control bg-danger-soft px-3 py-2 text-[12.5px] text-danger">{error}</p>}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[12px] text-faint">We add three starter services and one barber (you) so you can take bookings sooner.</p>
          <Button
            variant="primary"
            className="bg-[#173d33] hover:bg-[#1d4d40]"
            loading={create.isPending}
            disabled={!name.trim() || !area.trim()}
            onClick={() => {
              setError(null)
              create.mutate(undefined)
            }}
          >
            <Store /> Submit shop
          </Button>
        </div>
      </Card>
    </div>
  )
}

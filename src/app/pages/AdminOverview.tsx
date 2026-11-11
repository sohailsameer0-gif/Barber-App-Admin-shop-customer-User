import { ArrowRight, Banknote, CalendarDays, MapPin, Star, Store, TrendingUp, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { PLATFORM_FEE_PERCENT } from '../../shared/types'
import { AreaChart } from '../components/charts'
import { StatusBadge } from '../components/shop'
import { Badge, Card, PageHeader, Skeleton } from '../components/ui'
import { useAdminOverview } from '../lib/api'
import { joinedLabel, money, moneyCompact, timeLabel } from '../lib/format'

export function AdminOverview() {
  const { data, isLoading } = useAdminOverview()

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-[1180px] space-y-3 p-5 sm:p-8">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[108px] rounded-card" />
          ))}
        </div>
        <Skeleton className="h-[280px] rounded-card" />
      </div>
    )
  }

  const { kpis, series, cities, topShops, recent } = data

  return (
    <div className="mx-auto max-w-[1180px] p-5 sm:p-8">
      <PageHeader
        title="Platform"
        subtitle="Marketplace health across Pakistan. All amounts in PKR."
        actions={
          <Link
            to="/admin/shops"
            className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3.5 text-[13px] font-medium hover:bg-surface-2"
          >
            <Store className="size-4" /> Manage shops
            {kpis.pendingShops > 0 && <Badge tone="warning">{kpis.pendingShops} pending</Badge>}
          </Link>
        }
      />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Gross bookings" value={money(kpis.gmv)} hint={`${kpis.completed} completed visits`} icon={<Banknote />} />
        <Kpi label={`Platform fee (${PLATFORM_FEE_PERCENT}%)`} value={money(kpis.commission)} hint="Earned on completed visits" icon={<TrendingUp />} />
        <Kpi label="All bookings" value={String(kpis.bookings)} hint={`${kpis.customers} customers served`} icon={<CalendarDays />} />
        <Kpi
          label="Shops"
          value={String(kpis.approvedShops)}
          hint={`${kpis.pendingShops} awaiting approval`}
          icon={<Store />}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.7fr_1fr]">
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold">Booked value</h2>
            <span className="text-[12px] text-faint">Completed visits, last 14 days</span>
          </div>
          <div className="mt-4">
            <AreaChart data={series} height={210} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold">By city</h2>
            <span className="inline-flex items-center gap-1 text-[12px] text-faint">
              <MapPin className="size-3.5" /> {cities.length}
            </span>
          </div>
          <ul className="mt-4 space-y-3">
            {cities.slice(0, 7).map((city) => (
              <li key={city.city}>
                <div className="flex items-baseline justify-between text-[12.5px]">
                  <span className="font-medium">{city.city}</span>
                  <span className="text-muted tabular-nums">
                    {moneyCompact(city.revenue)} · {city.shops} shop{city.shops === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-[#173d33]"
                    style={{ width: `${Math.max(4, (city.revenue / Math.max(1, cities[0]?.revenue ?? 1)) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Top shops</h2>
            <Link to="/admin/shops" className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-fg">
              All shops <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <table className="mt-3 w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.08em] text-faint">
                <th className="pb-2 font-medium">Shop</th>
                <th className="pb-2 text-right font-medium">Bookings</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
                <th className="pb-2 text-right font-medium">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {topShops.map((shop) => (
                <tr key={shop.id} className="text-[13px]">
                  <td className="py-2.5">
                    <span className="block truncate font-medium">{shop.name}</span>
                    <span className="block text-[11.5px] text-faint">{shop.city}</span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{shop.bookings}</td>
                  <td className="py-2.5 text-right font-medium tabular-nums">{money(shop.revenue)}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3 fill-[#e0a12b] text-[#e0a12b]" />
                      {shop.rating === null ? '—' : shop.rating.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold">Latest bookings</h2>
            <span className="text-[12px] text-faint">Feed</span>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {recent.map((appointment) => (
              <li key={appointment.id} className="py-2.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{appointment.customerName}</span>
                  <span className="shrink-0 text-[12.5px] font-medium tabular-nums">{money(appointment.pricePkr)}</span>
                  <StatusBadge status={appointment.status} />
                </div>
                <p className="truncate text-[11.5px] text-faint">
                  {appointment.shopName} · {appointment.serviceName ?? 'Service'} · {joinedLabel(appointment.startsAt)},{' '}
                  {timeLabel(appointment.startsAt)}
                </p>
              </li>
            ))}
            {recent.length === 0 && <li className="py-6 text-center text-[12.5px] text-muted">No bookings yet.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Customers served" value={String(kpis.customers)} icon={<Users />} />
        <MiniStat label="Average rating" value={kpis.avgRating === null ? '—' : kpis.avgRating.toFixed(2)} icon={<Star />} />
        <MiniStat label="Pending approvals" value={String(kpis.pendingShops)} icon={<Store />} />
      </div>
    </div>
  )
}

function Kpi({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return (
    <Card className="flex h-[110px] flex-col justify-between p-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-muted">{label}</p>
        <span className="text-faint [&_svg]:size-4">{icon}</span>
      </div>
      <div>
        <p className="text-[21px] font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-faint">{hint}</p>
      </div>
    </Card>
  )
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
      <span className="grid size-8 place-items-center rounded-[10px] bg-bg text-[#173d33] [&_svg]:size-4">{icon}</span>
      <span>
        <span className="block text-[12px] text-muted">{label}</span>
        <span className="block text-[15px] font-semibold tabular-nums">{value}</span>
      </span>
    </div>
  )
}

import { Clock, MapPin, Scissors, Star } from 'lucide-react'
import { Link } from 'react-router'

import type { AppointmentStatus, ShopSummary } from '../../shared/types'
import { cx } from '../lib/cx'
import { clockLabel, money } from '../lib/format'
import { shopPhoto } from '../lib/photos'
import { Badge } from './ui'

const statusTone: Record<AppointmentStatus, 'warning' | 'info' | 'success' | 'neutral' | 'danger'> = {
  pending: 'warning',
  confirmed: 'info',
  completed: 'success',
  cancelled: 'neutral',
  no_show: 'danger',
}

const statusLabel: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge tone={statusTone[status]} dot>
      {statusLabel[status]}
    </Badge>
  )
}

export function Stars({ rating, count, size = 'sm' }: { rating: number | null; count?: number; size?: 'sm' | 'md' }) {
  const value = rating ?? 0
  return (
    <span className={cx('inline-flex items-center gap-1', size === 'sm' ? 'text-[12.5px]' : 'text-[13.5px]')}>
      <Star className={cx('fill-[#e0a12b] text-[#e0a12b]', size === 'sm' ? 'size-3.5' : 'size-4')} />
      <span className="font-medium tabular-nums">{rating === null ? 'New' : value.toFixed(1)}</span>
      {count !== undefined && count > 0 && <span className="text-faint">({count})</span>}
    </span>
  )
}

/**
 * A real barbershop photo when we have one for this shop, otherwise the warm
 * striped gradient. Either way the shop's hue tints the overlay.
 */
export function ShopCover({ hue, className, photoKey }: { hue: number; className?: string; photoKey?: string }) {
  const photo = photoKey ? shopPhoto(photoKey) : null
  return (
    <div
      className={cx('relative overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 32% 22%), hsl(${hue + 18} 42% 32%))` }}
      aria-hidden
    >
      {photo ? (
        <>
          <img src={photo} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, hsl(${hue} 34% 12% / 0.15), hsl(${hue} 34% 10% / 0.55))`,
            }}
          />
        </>
      ) : (
        <>
          <div
            className="absolute inset-0 opacity-[0.16]"
            style={{ backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.85) 0 1px, transparent 1px 14px)' }}
          />
          <div className="absolute -bottom-6 -right-3 opacity-[0.16]">
            <Scissors className="size-32 text-white" strokeWidth={1.1} />
          </div>
        </>
      )}
    </div>
  )
}

export function ShopCard({ shop }: { shop: ShopSummary }) {
  return (
    <Link
      to={`/shops/${shop.id}`}
      className="group flex flex-col overflow-hidden rounded-card bg-surface shadow-card transition-transform duration-200 hover:-translate-y-0.5"
    >
      <ShopCover hue={shop.hue} photoKey={shop.id} className="h-[132px]" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">{shop.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted">
              <MapPin className="size-3.5 shrink-0" />
              {shop.area}, {shop.city}
            </p>
          </div>
          <Stars rating={shop.rating} count={shop.reviewCount} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {clockLabel(shop.opensAt)} – {clockLabel(shop.closesAt)}
          </span>
          <span className="text-faint">·</span>
          <span>{shop.barberCount} barber{shop.barberCount === 1 ? '' : 's'}</span>
        </div>

        <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
          <p className="text-[13px] text-muted">
            From{' '}
            <span className="text-[14px] font-semibold text-fg tabular-nums">{shop.priceFrom === null ? '—' : money(shop.priceFrom)}</span>
          </p>
          <span className="rounded-[9px] bg-fg px-2.5 py-1.5 text-[12px] font-medium text-white transition-colors group-hover:bg-[#2a2a30]">
            Book a chair
          </span>
        </div>
      </div>
    </Link>
  )
}

import { Check, MapPin, Star, Store, X } from 'lucide-react'
import { useState } from 'react'

import type { ShopStatus } from '../../shared/types'
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, useToast } from '../components/ui'
import { api, useAdminShops, useApiMutation } from '../lib/api'
import { cx } from '../lib/cx'
import { joinedLabel, money } from '../lib/format'

const filters: { key: string; label: string }[] = [
  { key: '', label: 'All shops' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'suspended', label: 'Suspended' },
]

export function AdminShops() {
  const toast = useToast()
  const [filter, setFilter] = useState('')
  const { data, isLoading } = useAdminShops(filter)

  const setStatus = useApiMutation(
    (input: { id: string; status: ShopStatus; name: string }) =>
      api(`/admin/shops/${input.id}/status`, { method: 'POST', json: { status: input.status } }),
    ['admin-shops', 'admin-overview', 'shops'],
    {
      onSuccess: (_result, input) =>
        toast(`${input.name} ${input.status === 'approved' ? 'approved' : input.status === 'suspended' ? 'suspended' : 'set to pending'}`),
    },
  )

  const shops = data?.items ?? []

  return (
    <div className="mx-auto max-w-[1080px] p-5 sm:p-8">
      <PageHeader title="Shops" subtitle="Approve new barbershops, audit earnings and suspend bad actors." />

      <div className="mt-5 flex flex-wrap gap-1.5">
        {filters.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setFilter(entry.key)}
            className={cx(
              'h-8 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors',
              filter === entry.key ? 'border-fg bg-fg text-white' : 'border-line-strong bg-surface text-muted hover:text-fg',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <Card className="mt-3 overflow-hidden">
        {isLoading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-tile" />
            ))}
          </div>
        )}

        {!isLoading && shops.length === 0 && (
          <EmptyState icon={<Store />} title="Nothing here" description="No shops match this filter yet." />
        )}

        {shops.map((shop) => (
          <div key={shop.id} className="flex flex-wrap items-start gap-3 border-b border-line px-4 py-3.5 last:border-0">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-[12px] text-[15px] font-semibold"
              style={{ background: `hsl(${shop.hue} 40% 92%)`, color: `hsl(${shop.hue} 42% 28%)` }}
            >
              {shop.name.trim()[0]?.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                <span className="truncate">{shop.name}</span>
                <Badge tone={shop.status === 'approved' ? 'success' : shop.status === 'pending' ? 'warning' : 'danger'} dot>
                  {shop.status === 'approved' ? 'Approved' : shop.status === 'pending' ? 'Pending' : 'Suspended'}
                </Badge>
              </p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-faint">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" /> {shop.area}, {shop.city}
                </span>
                <span>{shop.ownerName ?? shop.ownerEmail ?? 'No owner profile'}</span>
                <span>joined {joinedLabel(shop.createdAt)}</span>
              </p>
              <p className="mt-1 text-[12px] font-medium tabular-nums sm:hidden">
                {money(shop.revenue)} <span className="font-normal text-faint">· {shop.bookings} bookings · ★ {shop.rating === null ? '—' : shop.rating.toFixed(1)}</span>
              </p>
            </div>
            <div className="hidden w-[92px] text-right sm:block">
              <p className="text-[13px] font-semibold tabular-nums">{money(shop.revenue)}</p>
              <p className="text-[11px] text-faint">{shop.bookings} bookings</p>
            </div>
            <div className="hidden w-[64px] text-right sm:block">
              <p className="inline-flex items-center gap-1 text-[12.5px] tabular-nums">
                <Star className="size-3 fill-[#e0a12b] text-[#e0a12b]" />
                {shop.rating === null ? '—' : shop.rating.toFixed(1)}
              </p>
              <p className="text-[11px] text-faint">{shop.reviewCount} reviews</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {shop.status !== 'approved' && (
                <Button size="sm" variant="primary" loading={setStatus.isPending} onClick={() => setStatus.mutate({ id: shop.id, status: 'approved', name: shop.name })}>
                  <Check /> Approve
                </Button>
              )}
              {shop.status !== 'suspended' && (
                <Button size="sm" onClick={() => setStatus.mutate({ id: shop.id, status: 'suspended', name: shop.name })}>
                  <X /> Suspend
                </Button>
              )}
              {shop.status === 'suspended' && (
                <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: shop.id, status: 'pending', name: shop.name })}>
                  Reset
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>

      <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
        Approving a shop makes it visible to customers immediately. Suspending hides it from the marketplace but keeps its bookings,
        services and reviews intact.
      </p>
    </div>
  )
}

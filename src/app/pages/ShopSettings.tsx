import { Star, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { CITIES } from '../../shared/types'
import { Badge, Button, Card, Field, Input, PageHeader, Select, Skeleton, Textarea, useToast } from '../components/ui'
import { api, useApiMutation, useMe, useShopDashboard, useShopReviews } from '../lib/api'
import { cx } from '../lib/cx'
import { relativeTime } from '../lib/format'

export function ShopSettings() {
  const { data: me } = useMe()
  const toast = useToast()
  const { data, isLoading } = useShopDashboard(Boolean(me?.shop))
  const reviews = useShopReviews()
  const shop = data?.shop

  const [name, setName] = useState('')
  const [city, setCity] = useState('Lahore')
  const [area, setArea] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [description, setDescription] = useState('')
  const [opensAt, setOpensAt] = useState('10:00')
  const [closesAt, setClosesAt] = useState('21:00')

  useEffect(() => {
    if (!shop) return
    setName(shop.name)
    setCity(shop.city)
    setArea(shop.area)
    setAddress(shop.address ?? '')
    setPhone(shop.phone ?? '')
    setDescription(shop.description ?? '')
    setOpensAt(shop.opensAt)
    setClosesAt(shop.closesAt)
  }, [shop])

  const save = useApiMutation(
    () => api('/shop', { method: 'PATCH', json: { name, city, area, address, phone, description, opensAt, closesAt } }),
    ['shop-dashboard', 'shop', 'shops', 'me'],
    { onSuccess: () => toast('Shop details saved') },
  )

  if (me && !me.shop) {
    return (
      <div className="mx-auto max-w-[720px] p-8 text-center">
        <Store className="mx-auto size-6 text-faint" />
        <h1 className="mt-3 text-[18px] font-semibold">No shop yet</h1>
        <p className="mt-1 text-[13.5px] text-muted">Set up your shop to manage its details.</p>
        <Link to="/shop" className="mt-5 inline-flex h-9 items-center rounded-control bg-fg px-4 text-[13px] font-medium text-white">
          Set up my shop
        </Link>
      </div>
    )
  }

  if (isLoading || !shop) {
    return (
      <div className="mx-auto max-w-[820px] space-y-3 p-5 sm:p-8">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-[380px] rounded-card" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[820px] p-5 sm:p-8">
      <PageHeader
        title="Shop settings"
        subtitle="What customers see, and when your chairs are open."
        actions={
          <Badge tone={shop.status === 'approved' ? 'success' : shop.status === 'pending' ? 'warning' : 'danger'} dot>
            {shop.status === 'approved' ? 'Approved' : shop.status === 'pending' ? 'Awaiting approval' : 'Suspended'}
          </Badge>
        }
      />

      <Card className="mt-5 p-5">
        <h2 className="text-[14px] font-semibold">Profile</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Shop name" className="sm:col-span-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
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
          <Field label="Area">
            <Input value={area} onChange={(event) => setArea(event.target.value)} maxLength={80} />
          </Field>
          <Field label="Full address" className="sm:col-span-2">
            <Input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={160} />
          </Field>
          <Field label="Shop mobile">
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" maxLength={40} />
          </Field>
          <Field label="Rating">
            <div className="flex h-9 items-center gap-2 rounded-control border border-line bg-surface-2 px-3 text-[13px]">
              <Star className="size-4 fill-[#e0a12b] text-[#e0a12b]" />
              {shop.rating === null ? 'No reviews yet' : `${shop.rating.toFixed(1)} · ${shop.reviewCount} reviews`}
            </div>
          </Field>
          <Field label="About the shop" className="sm:col-span-2">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
          </Field>
          <Field label="Opens at" hint="Pakistan Standard Time (UTC+5).">
            <Input type="time" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} />
          </Field>
          <Field label="Closes at">
            <Input type="time" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Save changes
          </Button>
        </div>
      </Card>

      <Card className="mt-3 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold">Reviews from customers</h2>
          <span className="text-[12px] text-faint">Only verified visits can review</span>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {(reviews.data?.items ?? []).map((review) => (
            <li key={review.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-medium">{review.customerName}</span>
                <span className="inline-flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className={cx('size-3', index < review.rating ? 'fill-[#e0a12b] text-[#e0a12b]' : 'text-line-strong')} />
                  ))}
                </span>
                <span className="ml-auto text-[11.5px] text-faint">{relativeTime(review.createdAt)}</span>
              </div>
              {review.serviceName && <p className="mt-0.5 text-[11.5px] text-faint">{review.serviceName}</p>}
              {review.body && <p className="mt-1 text-[13px] leading-relaxed text-muted">{review.body}</p>}
            </li>
          ))}
          {(reviews.data?.items.length ?? 0) === 0 && (
            <li className="py-6 text-center text-[13px] text-muted">No reviews yet. Complete a visit and ask the customer to review.</li>
          )}
        </ul>
      </Card>
    </div>
  )
}

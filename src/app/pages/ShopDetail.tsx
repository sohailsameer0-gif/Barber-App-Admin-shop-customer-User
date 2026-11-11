import { ArrowLeft, CalendarCheck, Check, Clock, MapPin, Phone, Scissors, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import type { Appointment } from '../../shared/types'
import { ShopCover, Stars } from '../components/shop'
import { Avatar, Badge, Button, Card, Field, Input, Select, Skeleton, Textarea, useToast } from '../components/ui'
import { api, ApiError, useApiMutation, useAvailability, useMe, useShop } from '../lib/api'
import { cx } from '../lib/cx'
import { rememberGuestCode } from '../lib/guest'
import { clockLabel, durationLabel, fullDay, money, relativeTime, shiftDateKey, timeLabel, todayKey } from '../lib/format'

export function ShopDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: me } = useMe()
  const { data, isLoading, error } = useShop(id)

  const [serviceId, setServiceId] = useState<string | null>(null)
  const [barberId, setBarberId] = useState('any')
  const [date, setDate] = useState(todayKey())
  const [time, setTime] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<{ appointment: Appointment; code: string | null; guestToken: string | null } | null>(null)
  const bookingRef = useRef<HTMLDivElement>(null)
  const signedIn = Boolean(me?.user)

  const shop = data?.shop
  const services = data?.services ?? []
  const service = services.find((entry) => entry.id === serviceId) ?? null

  useEffect(() => {
    if (!serviceId && services.length > 0) setServiceId(services[0].id)
  }, [serviceId, services])

  useEffect(() => {
    if (me?.profile?.phone && !phone) setPhone(me.profile.phone)
    if (me?.profile?.name && !name) setName(me.profile.name)
  }, [me, phone, name])

  const availability = useAvailability(id, { date, serviceId, barberId }, Boolean(service))
  const slots = availability.data?.slots ?? []
  const openSlots = slots.filter((slot) => slot.available)

  useEffect(() => setTime(null), [date, serviceId, barberId])


  const book = useApiMutation(
    (): Promise<{ appointment: Appointment; guestToken: string | null; code: string | null }> =>
      api('/bookings', {
        method: 'POST',
        json: { shopId: id, serviceId, barberId, date, time, notes, customerName: name, customerPhone: phone, customerEmail: email },
      }),
    ['bookings', 'availability'],
    {
      onSuccess: (result) => {
        toast('Booking sent — the shop will confirm shortly')
        if (result.guestToken) {
          rememberGuestCode(result.guestToken)
          setConfirmed(result)
          return
        }
        navigate('/bookings')
      },
      onError: (mutationError) => {
        const message = mutationError instanceof ApiError ? mutationError.message : 'Could not book that slot.'
        setFormError(message)
        toast(message, 'danger')
        availability.refetch()
      },
    },
  )

  const cancelGuest = useApiMutation(
    (token: string) => api(`/bookings/guest/${token}/cancel`, { method: 'POST' }),
    ['guest-bookings', 'availability'],
    {
      onSuccess: () => {
        toast('Booking cancelled')
        setConfirmed(null)
      },
      onError: (mutationError) => toast(mutationError instanceof ApiError ? mutationError.message : 'Could not cancel.', 'danger'),
    },
  )

  const days = useMemo(() => Array.from({ length: 10 }, (_, index) => shiftDateKey(todayKey(), index)), [])
  const today = todayKey()
  const weekday = (key: string) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(new Date(`${key}T12:00:00Z`))
  // Late in the day today can have no chairs left; open the next day instead of
  // showing a wall of struck-through times.
  const autoAdvanced = useRef(false)
  useEffect(() => {
    const slots = availability.data?.slots
    if (autoAdvanced.current || availability.isFetching || !slots || slots.length === 0) return
    if (date === today && slots.every((slot) => !slot.available)) {
      autoAdvanced.current = true
      setDate(shiftDateKey(date, 1))
    }
  }, [availability.data, availability.isFetching, date, today])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1180px] space-y-3 p-5 sm:p-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[190px] rounded-card" />
        <Skeleton className="h-[320px] rounded-card" />
      </div>
    )
  }

  if (error || !shop) {
    return (
      <div className="mx-auto max-w-[720px] p-8 text-center">
        <Scissors className="mx-auto size-6 text-faint" />
        <h1 className="mt-3 text-[18px] font-semibold">This shop is not available</h1>
        <p className="mt-1 text-[13.5px] text-muted">It may be awaiting approval or no longer listed.</p>
        <Link to="/" className="mt-5 inline-flex h-9 items-center rounded-control bg-fg px-4 text-[13px] font-medium text-white">
          Browse other shops
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1180px] p-5 sm:p-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All shops
      </Link>

      <div className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
        <ShopCover hue={shop.hue} photoKey={shop.id} className="h-[180px] sm:h-[220px]" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-semibold tracking-[-0.025em]">{shop.name}</h1>
              <Badge tone="success" dot>
                Verified
              </Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" /> {shop.address ?? `${shop.area}, ${shop.city}`}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-4" /> {clockLabel(shop.opensAt)} – {clockLabel(shop.closesAt)}
              </span>
              {shop.phone && (
                <a href={`tel:${shop.phone}`} className="inline-flex items-center gap-1 hover:text-fg">
                  <Phone className="size-4" /> {shop.phone}
                </a>
              )}
            </p>
            {shop.description && <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted">{shop.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-control bg-bg px-4 py-3">
            <div>
              <Stars rating={shop.rating} count={shop.reviewCount} size="md" />
              <p className="mt-0.5 text-[11.5px] text-faint">{shop.reviewCount} visit review{shop.reviewCount === 1 ? '' : 's'}</p>
            </div>
            <div className="h-8 w-px bg-line" />
            <div>
              <p className="text-[15px] font-semibold tabular-nums">{shop.priceFrom === null ? '—' : money(shop.priceFrom)}</p>
              <p className="text-[11.5px] text-faint">starting price</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_372px]">
        <div className="min-w-0 space-y-3">
          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">Services</h2>
              <span className="text-[12px] text-faint">{services.length} on the menu</span>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {services.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium">{entry.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-faint">
                      <Clock className="size-3.5" /> {durationLabel(entry.durationMin)}
                    </p>
                  </div>
                  <p className="text-[14px] font-semibold tabular-nums">{money(entry.pricePkr)}</p>
                  <Button
                    size="sm"
                    variant={serviceId === entry.id ? 'primary' : 'secondary'}
                    onClick={() => {
                      setServiceId(entry.id)
                      setTime(null)
                      bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                  >
                    {serviceId === entry.id ? 'Selected' : 'Book'}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">The team</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {data?.barbers.map((barber) => (
                <div key={barber.id} className="flex items-center gap-3 rounded-control border border-line px-3 py-2.5">
                  <Avatar name={barber.name} hue={barber.hue} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium">{barber.name}</p>
                    <p className="truncate text-[12px] text-faint">{barber.title}</p>
                  </div>
                  {barber.bookings > 0 && (
                    <span className="ml-auto shrink-0 text-[11.5px] text-faint">{barber.bookings} cuts</span>
                  )}
                </div>
              ))}
              {data?.barbers.length === 0 && <p className="text-[13px] text-muted">Team details coming soon.</p>}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">Reviews</h2>
              <Stars rating={shop.rating} count={shop.reviewCount} />
            </div>
            <ul className="mt-2 divide-y divide-line">
              {data?.reviews.map((review) => (
                <li key={review.id} className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium">{review.customerName}</span>
                    <span className="inline-flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          className={cx('size-3', index < review.rating ? 'fill-[#e0a12b] text-[#e0a12b]' : 'text-line-strong')}
                        />
                      ))}
                    </span>
                    <span className="ml-auto text-[11.5px] text-faint">{relativeTime(review.createdAt)}</span>
                  </div>
                  {review.serviceName && <p className="mt-0.5 text-[11.5px] text-faint">{review.serviceName}</p>}
                  {review.body && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{review.body}</p>}
                </li>
              ))}
              {data?.reviews.length === 0 && (
                <li className="py-6 text-center text-[13px] text-muted">No reviews yet — be the first after your visit.</li>
              )}
            </ul>
          </Card>
        </div>

        <div ref={bookingRef} className="min-w-0 lg:sticky lg:top-0 lg:self-start">
          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">Book a chair</h2>
              <span className="text-[11.5px] text-faint">Asia/Karachi</span>
            </div>

            {confirmed ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-control border border-success/30 bg-success-soft px-3 py-3">
                  <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success">
                    <CalendarCheck className="size-4" /> Chair requested
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                    {confirmed.appointment.shopName} will confirm on {confirmed.appointment.customerPhone ?? 'your mobile'} shortly.
                  </p>
                </div>

                {confirmed.code && (
                  <div className="rounded-control bg-bg px-3 py-3 text-center">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-faint">Your booking code</p>
                    <p className="mt-1 text-[22px] font-semibold tracking-[0.08em] tabular-nums">{confirmed.code}</p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
                      Saved in this browser. Show it at the shop, or use it to cancel.
                    </p>
                  </div>
                )}

                <dl className="space-y-1.5 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Service</dt>
                    <dd className="text-right font-medium">{confirmed.appointment.serviceName ?? 'Service'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">When</dt>
                    <dd className="text-right font-medium tabular-nums">
                      {fullDay(confirmed.appointment.startsAt)} · {timeLabel(confirmed.appointment.startsAt)}
                    </dd>
                  </div>
                  {confirmed.appointment.barberName && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Barber</dt>
                      <dd className="text-right font-medium">{confirmed.appointment.barberName}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Pay at the shop</dt>
                    <dd className="text-right font-semibold tabular-nums">{money(confirmed.appointment.pricePkr)}</dd>
                  </div>
                </dl>

                <div className="flex gap-2">
                  <Button className="h-9 flex-1" onClick={() => setConfirmed(null)}>
                    Book another
                  </Button>
                  {confirmed.guestToken && (
                    <Button
                      className="h-9 flex-1"
                      variant="danger"
                      loading={cancelGuest.isPending}
                      onClick={() => confirmed.guestToken && cancelGuest.mutate(confirmed.guestToken)}
                    >
                      Cancel booking
                    </Button>
                  )}
                </div>
                <p className="text-center text-[11.5px] text-faint">
                  All bookings on this device are listed under My bookings.
                </p>
              </div>
            ) : (
            <div className="mt-4 space-y-3">
              <Field label="Service">
                <Select value={serviceId ?? ''} onChange={(event) => setServiceId(event.target.value)}>
                  {services.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} · {money(entry.pricePkr)}
                    </option>
                  ))}
                </Select>
              </Field>

              <div>
                <p className="text-[13px] font-medium">Barber</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBarberId('any')}
                    className={cx(
                      'h-8 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
                      barberId === 'any' ? 'border-fg bg-fg text-white' : 'border-line-strong bg-surface text-muted hover:text-fg',
                    )}
                  >
                    Any barber
                  </button>
                  {data?.barbers.map((barber) => (
                    <button
                      key={barber.id}
                      type="button"
                      onClick={() => setBarberId(barber.id)}
                      className={cx(
                        'h-8 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
                        barberId === barber.id ? 'border-fg bg-fg text-white' : 'border-line-strong bg-surface text-muted hover:text-fg',
                      )}
                    >
                      {barber.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[13px] font-medium">Date</p>
                <div className="scrollbar-thin -mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {days.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDate(key)}
                      className={cx(
                        'flex h-14 w-[60px] shrink-0 flex-col items-center justify-center rounded-control border text-[11px] transition-colors',
                        date === key ? 'border-fg bg-fg text-white' : 'border-line-strong bg-surface text-muted hover:text-fg',
                      )}
                    >
                      <span className="font-medium">
                        {key === today ? 'Today' : key === days[1] ? 'Tmrw' : weekday(key)}
                      </span>
                      <span className={cx('mt-0.5 text-[15px] font-semibold tabular-nums', date === key ? 'text-white' : 'text-fg')}>
                        {Number(key.slice(-2))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-[13px] font-medium">Time</p>
                  <span className="text-[11.5px] text-faint">
                    {availability.isFetching ? 'Checking…' : `${openSlots.length} open`}
                  </span>
                </div>
                {availability.data?.closed ? (
                  <p className="mt-2 rounded-control bg-surface-2 px-3 py-3 text-[12.5px] text-muted">
                    This service does not fit in the shop’s hours. Try a shorter service.
                  </p>
                ) : (
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {slots.slice(0, 18).map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setTime(slot.time)}
                        className={cx(
                          'h-8 rounded-tile border text-[12px] font-medium tabular-nums transition-colors',
                          time === slot.time
                            ? 'border-[#173d33] bg-[#173d33] text-white'
                            : slot.available
                              ? 'border-line-strong bg-surface text-fg hover:border-fg'
                              : 'border-line bg-surface-2 text-faint line-through',
                        )}
                      >
                        {clockLabel(slot.time)}
                      </button>
                    ))}
                  </div>
                )}
                {!availability.isLoading && slots.length === 0 && !availability.data?.closed && (
                  <p className="mt-2 text-[12.5px] text-muted">No chairs configured yet for this day.</p>
                )}
              </div>

              {!signedIn && (
                <Field label="Your name">
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ahmed Raza"
                    autoComplete="name"
                    maxLength={80}
                  />
                </Field>
              )}

              <Field label="Mobile number" hint="The shop uses this to confirm or reschedule.">
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0300 1234567"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={40}
                />
              </Field>

              {!signedIn && (
                <Field label="Email (optional)" hint="Only for a receipt or a reminder.">
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={120}
                  />
                </Field>
              )}

              <Field label="Notes (optional)">
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Keep the top long, skin fade on the sides…"
                  maxLength={500}
                  className="min-h-[64px]"
                />
              </Field>

              <div className="flex items-center justify-between rounded-control bg-bg px-3 py-2.5 text-[13px]">
                <span className="text-muted">Total to pay at the shop</span>
                <span className="text-[15px] font-semibold tabular-nums">{service ? money(service.pricePkr) : '—'}</span>
              </div>

              {formError && <p className="rounded-control bg-danger-soft px-3 py-2 text-[12.5px] text-danger">{formError}</p>}

              <Button
                variant="primary"
                className="h-10 w-full bg-[#173d33] hover:bg-[#1d4d40]"
                loading={book.isPending}
                disabled={!service || !time}
                onClick={() => {
                  setFormError(null)
                  book.mutate(undefined)
                }}
              >
                <Check /> Confirm booking
              </Button>
              <p className="text-center text-[11.5px] leading-relaxed text-faint">
                {signedIn ? 'Pay the barber directly in cash or Easypaisa. Free to book, cancel any time before your slot.' : 'No account needed — just your name and number. Pay the barber at the shop.'}
              </p>
            </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

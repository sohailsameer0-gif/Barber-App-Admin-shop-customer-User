import { CalendarDays, Check, MapPin, Scissors, Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { Appointment } from '../../shared/types'
import { StatusBadge } from '../components/shop'
import { Avatar, Button, Card, ConfirmDialog, Dialog, EmptyState, PageHeader, Skeleton, Textarea, useToast } from '../components/ui'
import { api, useApiMutation, useGuestBookings, useMe, useMyBookings } from '../lib/api'
import { cx } from '../lib/cx'
import { fullDay, money, timeLabel } from '../lib/format'
import { forgetGuestCode, loadGuestCodes, splitGuestBookings } from '../lib/guest'

export function Bookings() {
  const toast = useToast()
  const { data: me } = useMe()
  const signedIn = Boolean(me?.user)
  const [codes, setCodes] = useState<string[]>(() => loadGuestCodes())
  const mine = useMyBookings(signedIn)
  const guests = useGuestBookings(signedIn ? [] : codes)
  const data = signedIn ? mine.data : guests.data ? splitGuestBookings(guests.data.appointments) : undefined
  const isLoading = signedIn ? mine.isLoading : guests.isLoading
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [cancelling, setCancelling] = useState<Appointment | null>(null)
  const [reviewing, setReviewing] = useState<Appointment | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const cancel = useApiMutation(
    (appointment: Appointment) =>
      appointment.guestToken
        ? api(`/bookings/guest/${appointment.guestToken}/cancel`, { method: 'POST' })
        : api(`/bookings/${appointment.id}/cancel`, { method: 'POST' }),
    ['bookings', 'guest-bookings', 'availability'],
    {
      onSuccess: (_result, appointment) => {
        // A guest's only handle on the booking is its code, so refresh the list
        // from the codes that are still on this device.
        setCodes(loadGuestCodes())
        setCancelling(null)
        if (appointment.guestToken && appointment.status === 'cancelled') forgetGuestCode(appointment.guestToken)
        toast('Booking cancelled')
      },
      onError: (error) => toast(error instanceof Error ? error.message : 'Could not cancel.', 'danger'),
    },
  )

  const review = useApiMutation(
    (input: { id: string; rating: number; body: string }) =>
      api(`/bookings/${input.id}/review`, { method: 'POST', json: { rating: input.rating, body: input.body } }),
    ['bookings', 'shop'],
    {
      onSuccess: () => {
        setReviewing(null)
        setComment('')
        setRating(5)
        toast('Thanks — your review is live')
      },
    },
  )

  const items = tab === 'upcoming' ? (data?.upcoming ?? []) : (data?.past ?? [])

  return (
    <div className="mx-auto max-w-[900px] p-5 sm:p-8">
      <PageHeader
        title="My bookings"
        subtitle={
          signedIn
            ? 'Your chairs across Pakistan, all in one place.'
            : 'Bookings made on this device. Keep your code to cancel or show at the shop.'
        }
        actions={
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-control bg-fg px-4 text-[13px] font-medium text-white hover:bg-[#26262c]"
          >
            <Scissors className="size-4" /> Book another
          </Link>
        }
      />

      <div className="mt-5 inline-flex rounded-control bg-surface-2 p-1">
        {(['upcoming', 'past'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cx(
              'h-8 rounded-[9px] px-4 text-[13px] font-medium capitalize transition-colors',
              tab === key ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
            )}
          >
            {key}
            <span className="ml-1.5 text-[11.5px] text-faint">
              {key === 'upcoming' ? data?.upcoming.length ?? 0 : data?.past.length ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2.5">
        {isLoading && Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-[124px] rounded-card" />)}

        {items.map((appointment) => {
          const live = appointment.status === 'pending' || appointment.status === 'confirmed'
          const canReview = signedIn && appointment.status === 'completed' && !appointment.reviewed
          return (
            <Card key={appointment.id} className="p-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex w-[74px] shrink-0 flex-col items-center rounded-control bg-bg py-2">
                  <span className="text-[11px] uppercase tracking-[0.1em] text-faint">
                    {new Date(appointment.startsAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi', month: 'short' })}
                  </span>
                  <span className="text-[20px] font-semibold leading-tight tabular-nums">
                    {new Date(appointment.startsAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric' })}
                  </span>
                  <span className="text-[10.5px] text-muted">
                    {new Date(appointment.startsAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi', weekday: 'short' })}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/shops/${appointment.shopId}`} className="text-[14.5px] font-semibold hover:underline">
                      {appointment.shopName}
                    </Link>
                    <StatusBadge status={appointment.status} />
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" /> {appointment.shopArea}, {appointment.shopCity}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" /> {fullDay(appointment.startsAt)} · {timeLabel(appointment.startsAt)}
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
                    <span className="inline-flex items-center gap-1.5">
                      <Scissors className="size-3.5 text-faint" /> {appointment.serviceName ?? 'Service'}
                    </span>
                    {appointment.barberName && (
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar name={appointment.barberName} hue={(appointment.shopHue ?? 158) + 40} size={18} />
                        {appointment.barberName}
                      </span>
                    )}
                    <span className="font-medium tabular-nums">{money(appointment.pricePkr)}</span>
                  </div>
                  {appointment.code && (
                    <p className="mt-2 text-[11.5px] text-faint">
                      Code <span className="font-semibold tracking-[0.08em] text-muted tabular-nums">{appointment.code}</span>
                    </p>
                  )}
                  {appointment.notes && <p className="mt-2 text-[12px] italic text-faint">“{appointment.notes}”</p>}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {live && (
                    <Button size="sm" onClick={() => setCancelling(appointment)}>
                      Cancel
                    </Button>
                  )}
                  {canReview && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setReviewing(appointment)
                        setRating(5)
                        setComment('')
                      }}
                    >
                      <Star className="size-3.5" /> Leave review
                    </Button>
                  )}
                  {appointment.reviewed && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-success">
                      <Check className="size-3.5" /> Reviewed
                    </span>
                  )}
                </div>
              </div>
            </Card>
          )
        })}

        {!isLoading && items.length === 0 && (
          <EmptyState
            icon={<CalendarDays />}
            title={tab === 'upcoming' ? 'No upcoming chairs' : 'No past visits yet'}
            description={
              tab === 'upcoming'
                ? 'Find a barbershop near you and lock a time — it takes about thirty seconds.'
                : 'Completed and cancelled visits show up here.'
            }
            action={
              <Link to="/" className="inline-flex h-9 items-center rounded-control bg-fg px-4 text-[13px] font-medium text-white">
                Browse shops
              </Link>
            }
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
        loading={cancel.isPending}
        title="Cancel this booking?"
        description={`${cancelling?.serviceName ?? 'This booking'} at ${cancelling?.shopName ?? 'the shop'} on ${
          cancelling ? `${fullDay(cancelling.startsAt)}, ${timeLabel(cancelling.startsAt)}` : ''
        } will be released for someone else.`}
        confirmLabel="Cancel booking"
      />

      <Dialog
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="How was your visit?"
        description={`${reviewing?.serviceName ?? 'Your visit'} at ${reviewing?.shopName ?? 'the shop'}`}
        footer={
          <>
            <Button onClick={() => setReviewing(null)}>Not now</Button>
            <Button
              variant="primary"
              loading={review.isPending}
              onClick={() => reviewing && review.mutate({ id: reviewing.id, rating, body: comment })}
            >
              Post review
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                onClick={() => setRating(value)}
                className="p-1"
              >
                <Star className={cx('size-7 transition-colors', value <= rating ? 'fill-[#e0a12b] text-[#e0a12b]' : 'text-line-strong')} />
              </button>
            ))}
          </div>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Tell other customers how the cut and service were…"
            maxLength={600}
          />
          <p className="text-[12px] text-faint">Reviews are public and shown on the shop page.</p>
        </div>
      </Dialog>
    </div>
  )
}

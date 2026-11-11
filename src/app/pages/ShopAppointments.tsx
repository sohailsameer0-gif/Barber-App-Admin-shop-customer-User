import { CalendarDays, ChevronLeft, ChevronRight, Clock, MoreHorizontal, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import type { AppointmentStatus } from '../../shared/types'
import { StatusBadge } from '../components/shop'
import { Avatar, Button, Card, Dialog, EmptyState, Field, Input, Menu, PageHeader, Select, Skeleton, useToast } from '../components/ui'
import {
  api,
  ApiError,
  useApiMutation,
  useMe,
  useShopAppointments,
  useShopAvailability,
  useShopBarbers,
  useShopServices,
} from '../lib/api'
import { cx } from '../lib/cx'
import { clockLabel, money, shiftDateKey, timeLabel, todayKey } from '../lib/format'

const statusFilters: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'no_show', label: 'No-show' },
]

export function ShopAppointments() {
  const { data: me } = useMe()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(todayKey())
  const [status, setStatus] = useState('')
  const { data, isLoading } = useShopAppointments(date)
  const addOpen = params.get('add') === '1'

  const setStatusMutation = useApiMutation(
    (input: { id: string; status: AppointmentStatus }) => api(`/shop/appointments/${input.id}/status`, { method: 'POST', json: { status: input.status } }),
    ['shop-appointments', 'shop-dashboard', 'bookings'],
    { onSuccess: (_result, input) => toast(`Marked ${input.status.replace('_', ' ')}`) },
  )

  const items = (data?.items ?? []).filter((appointment) => !status || appointment.status === status)
  const total = items.reduce((sum, appointment) => (appointment.status === 'completed' ? sum + appointment.pricePkr : sum), 0)

  if (me && !me.shop) {
    return (
      <div className="mx-auto max-w-[720px] p-8">
        <EmptyState
          icon={<CalendarDays />}
          title="No shop yet"
          description="Create your shop first, then appointments will show up here."
          action={
            <Link to="/shop" className="inline-flex h-9 items-center rounded-control bg-fg px-4 text-[13px] font-medium text-white">
              Set up my shop
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1000px] p-5 sm:p-8">
      <PageHeader
        title="Appointments"
        subtitle="Confirm requests, check in walk-ins and close out the day."
        actions={
          <Button variant="primary" onClick={() => setParams({ add: '1' })}>
            <Plus /> Walk-in
          </Button>
        }
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-control border border-line-strong bg-surface p-1">
          <Button size="icon-sm" variant="ghost" aria-label="Previous day" onClick={() => setDate((current) => shiftDateKey(current, -1))}>
            <ChevronLeft />
          </Button>
          <input
            type="date"
            value={date}
            onChange={(event) => event.target.value && setDate(event.target.value)}
            className="h-7 w-[132px] bg-transparent text-center text-[12.5px] font-medium outline-none"
            aria-label="Appointment date"
          />
          <Button size="icon-sm" variant="ghost" aria-label="Next day" onClick={() => setDate((current) => shiftDateKey(current, 1))}>
            <ChevronRight />
          </Button>
        </div>
        <Button size="sm" onClick={() => setDate(todayKey())} disabled={date === todayKey()}>
          Today
        </Button>
        <span className="ml-auto text-[12.5px] text-muted">
          {items.length} booking{items.length === 1 ? '' : 's'} · {money(total)} completed
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {statusFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setStatus(filter.key)}
            className={cx(
              'h-7 rounded-full border px-3 text-[12px] font-medium transition-colors',
              status === filter.key ? 'border-fg bg-fg text-white' : 'border-line-strong bg-surface text-muted hover:text-fg',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <Card className="mt-3 divide-y divide-line">
        {isLoading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="m-3 h-14 rounded-tile" />)}

        {items.map((appointment) => (
          <div key={appointment.id} className="flex items-start gap-3 px-4 py-3">
            <div className="w-[64px] shrink-0">
              <p className="whitespace-nowrap text-[13px] font-semibold tabular-nums">{timeLabel(appointment.startsAt)}</p>
              <p className="text-[11px] text-faint">{appointment.durationMin} min</p>
            </div>
            <Avatar name={appointment.customerName} hue={(appointment.shopHue ?? 158) + 30} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium">{appointment.customerName}</p>
              <p className="truncate text-[12px] text-faint">
                {appointment.serviceName ?? 'Service'} · {appointment.barberName ?? 'Any barber'}
              </p>
              {appointment.customerPhone && (
                <a href={`tel:${appointment.customerPhone}`} className="block truncate text-[11.5px] text-muted hover:text-fg">
                  {appointment.customerPhone}
                </a>
              )}
              {appointment.notes && <p className="truncate text-[11.5px] italic text-faint">“{appointment.notes}”</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium tabular-nums">{money(appointment.pricePkr)}</span>
                <StatusBadge status={appointment.status} />
              </div>
            </div>
            <Menu
              trigger={
                <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${appointment.customerName}`}>
                  <MoreHorizontal />
                </Button>
              }
              items={[
                { label: 'Confirm booking', onSelect: () => setStatusMutation.mutate({ id: appointment.id, status: 'confirmed' }) },
                { label: 'Mark completed', onSelect: () => setStatusMutation.mutate({ id: appointment.id, status: 'completed' }) },
                { label: 'Mark no-show', onSelect: () => setStatusMutation.mutate({ id: appointment.id, status: 'no_show' }) },
                { label: 'Cancel booking', danger: true, onSelect: () => setStatusMutation.mutate({ id: appointment.id, status: 'cancelled' }) },
              ]}
            />
          </div>
        ))}

        {!isLoading && items.length === 0 && (
          <EmptyState
            icon={<CalendarDays />}
            title={date === todayKey() ? 'No bookings today' : 'Nothing on this day'}
            description="Add a walk-in for someone at the counter, or share your shop link to fill the chairs."
            action={<Button onClick={() => setParams({ add: '1' })}>Add walk-in</Button>}
          />
        )}
      </Card>

      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-faint">
        <Clock className="size-3.5" /> All times are Pakistan Standard Time (UTC+5).
      </p>

      <WalkInDialog
        open={addOpen}
        onClose={() => {
          params.delete('add')
          setParams(params)
        }}
        date={date}
      />
    </div>
  )
}

function WalkInDialog({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const toast = useToast()
  const { data: services } = useShopServices()
  const { data: barbers } = useShopBarbers()
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [barberId, setBarberId] = useState('any')
  const [walkDate, setWalkDate] = useState(date)
  const [time, setTime] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!serviceId && services?.items.length) setServiceId(services.items[0].id)
  }, [serviceId, services])

  useEffect(() => {
    setWalkDate(date)
    setTime('')
  }, [date, open])

  const availability = useShopAvailability({ date: walkDate, serviceId: serviceId || null, barberId }, Boolean(serviceId) && open)

  const slots = (availability.data?.slots ?? []).filter((slot) => slot.available)

  const create = useApiMutation(
    () =>
      api('/shop/appointments', {
        method: 'POST',
        json: { serviceId, barberId, date: walkDate, time, customerName, customerPhone: phone, status: 'confirmed' },
      }),
    ['shop-appointments', 'shop-dashboard', 'bookings', 'availability'],
    {
      onSuccess: () => {
        toast('Walk-in added')
        setCustomerName('')
        setPhone('')
        setTime('')
        onClose()
      },
      onError: (mutationError) => {
        const message = mutationError instanceof ApiError ? mutationError.message : 'Could not add the walk-in.'
        setError(message)
        toast(message, 'danger')
      },
    },
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a walk-in"
      description="For the customer sitting in your chair right now."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={!customerName.trim() || !serviceId || !time}
            onClick={() => {
              setError(null)
              create.mutate(undefined)
            }}
          >
            Add booking
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer name" className="sm:col-span-2">
          <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={80} />
        </Field>
        <Field label="Mobile (optional)">
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" maxLength={40} />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={walkDate}
            onChange={(event) => {
              setWalkDate(event.target.value)
              setTime('')
            }}
          />
        </Field>
        <Field label="Service">
          <Select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            {(services?.items ?? [])
              .filter((service) => service.active)
              .map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {money(service.pricePkr)}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Barber">
          <Select value={barberId} onChange={(event) => setBarberId(event.target.value)}>
            <option value="any">Any barber</option>
            {(barbers?.items ?? [])
              .filter((barber) => barber.active)
              .map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Time" className="sm:col-span-2">
          <Select value={time} onChange={(event) => setTime(event.target.value)}>
            <option value="">Pick a free slot</option>
            {slots.map((slot) => (
              <option key={slot.time} value={slot.time}>
                {clockLabel(slot.time)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {availability.data?.closed && (
        <p className="mt-3 rounded-control bg-warning-soft px-3 py-2 text-[12.5px] text-warning">
          That service does not fit before closing time.
        </p>
      )}
      {!availability.isLoading && slots.length === 0 && !availability.data?.closed && (
        <p className="mt-3 rounded-control bg-warning-soft px-3 py-2 text-[12.5px] text-warning">
          No free chairs for that service on this day.
        </p>
      )}
      {error && <p className="mt-3 rounded-control bg-danger-soft px-3 py-2 text-[12.5px] text-danger">{error}</p>}
    </Dialog>
  )
}


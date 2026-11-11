import { Clock, Pencil, Plus, Scissors, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { Service } from '../../shared/types'
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, Field, Input, PageHeader, Skeleton, useToast } from '../components/ui'
import { api, useApiMutation, useMe, useShopServices } from '../lib/api'
import { durationLabel, money } from '../lib/format'

export function ShopServices() {
  const { data: me } = useMe()
  const toast = useToast()
  const { data, isLoading } = useShopServices()
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Service | null>(null)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('800')
  const [duration, setDuration] = useState('30')

  const invalidate = ['shop-services', 'shop-dashboard', 'shop', 'shops', 'shop-availability', 'availability']

  const save = useApiMutation(
    (input: { id?: string; name: string; pricePkr: number; durationMin: number }) =>
      input.id
        ? api(`/shop/services/${input.id}`, { method: 'PATCH', json: input })
        : api('/shop/services', { method: 'POST', json: input }),
    invalidate,
    {
      onSuccess: (_result, input) => {
        toast(input.id ? 'Service updated' : 'Service added')
        setEditing(null)
      },
    },
  )

  const toggle = useApiMutation(
    (input: { id: string; active: boolean }) => api(`/shop/services/${input.id}`, { method: 'PATCH', json: { active: input.active } }),
    invalidate,
  )

  const remove = useApiMutation((id: string) => api(`/shop/services/${id}`, { method: 'DELETE' }), invalidate, {
    onSuccess: () => {
      setDeleting(null)
      toast('Service removed')
    },
  })

  if (me && !me.shop) {
    return (
      <div className="mx-auto max-w-[720px] p-8">
        <EmptyState
          icon={<Scissors />}
          title="No shop yet"
          description="Create your shop to build your service menu."
          action={
            <Link to="/shop" className="inline-flex h-9 items-center rounded-control bg-fg px-4 text-[13px] font-medium text-white">
              Set up my shop
            </Link>
          }
        />
      </div>
    )
  }

  const services = data?.items ?? []

  const openNew = () => {
    setName('')
    setPrice('800')
    setDuration('30')
    setEditing('new')
  }

  const openEdit = (service: Service) => {
    setName(service.name)
    setPrice(String(service.pricePkr))
    setDuration(String(service.durationMin))
    setEditing(service)
  }

  return (
    <div className="mx-auto max-w-[900px] p-5 sm:p-8">
      <PageHeader
        title="Services & prices"
        subtitle="Your menu in Pakistani rupees. Customers see these prices before booking."
        actions={
          <Button variant="primary" onClick={openNew}>
            <Plus /> Add service
          </Button>
        }
      />

      <div className="mt-5 grid gap-2">
        {isLoading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[68px] rounded-card" />)}

        {services.map((service) => (
          <Card key={service.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-bg text-[#173d33]">
              <Scissors className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[13.5px] font-medium">
                {service.name}
                {!service.active && <Badge tone="neutral">Hidden</Badge>}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-faint">
                <Clock className="size-3.5" /> {durationLabel(service.durationMin)}
              </p>
            </div>
            <p className="text-[14px] font-semibold tabular-nums">{money(service.pricePkr)}</p>
            <Button size="sm" onClick={() => toggle.mutate({ id: service.id, active: !service.active })}>
              {service.active ? 'Hide' : 'Show'}
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${service.name}`} onClick={() => openEdit(service)}>
              <Pencil />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={`Delete ${service.name}`} onClick={() => setDeleting(service)}>
              <Trash2 />
            </Button>
          </Card>
        ))}

        {!isLoading && services.length === 0 && (
          <EmptyState
            icon={<Scissors />}
            title="Your menu is empty"
            description="Add your first service with a price in rupees and how long it takes."
            action={<Button onClick={openNew}>Add service</Button>}
          />
        )}
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-faint">
        Hiding a service removes it from the customer menu without touching past bookings. Deleting a service that has been used keeps it
        archived so old appointments still show what was done.
      </p>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add a service' : 'Edit service'}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={save.isPending}
              disabled={!name.trim() || !price}
              onClick={() =>
                save.mutate({
                  id: editing && editing !== 'new' ? editing.id : undefined,
                  name: name.trim(),
                  pricePkr: Math.round(Number(price) || 0),
                  durationMin: Math.round(Number(duration) || 30),
                })
              }
            >
              Save service
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Service name" className="sm:col-span-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Haircut + Beard" maxLength={60} />
          </Field>
          <Field label="Price (PKR)">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px] text-faint">Rs</span>
              <Input
                value={price}
                onChange={(event) => setPrice(event.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                className="pl-9 tabular-nums"
              />
            </div>
          </Field>
          <Field label="Duration (minutes)" hint="Used to work out free slots.">
            <Input
              value={duration}
              onChange={(event) => setDuration(event.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              className="tabular-nums"
            />
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title={`Remove ${deleting?.name ?? 'service'}?`}
        description="It disappears from your menu. Appointments already booked are kept for your records."
        confirmLabel="Remove service"
      />
    </div>
  )
}

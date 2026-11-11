import { Pencil, Phone, Plus, Scissors, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { Barber } from '../../shared/types'
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  useToast,
} from '../components/ui'
import { api, useApiMutation, useMe, useShopBarbers } from '../lib/api'

export function ShopTeam() {
  const { data: me } = useMe()
  const toast = useToast()
  const { data, isLoading } = useShopBarbers()
  const [editing, setEditing] = useState<Barber | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Barber | null>(null)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('Barber')
  const [phone, setPhone] = useState('')

  const invalidate = ['shop-barbers', 'shop-dashboard', 'shop', 'shops', 'shop-availability', 'availability']

  const save = useApiMutation(
    (input: { id?: string; name: string; title: string; phone: string }) =>
      input.id
        ? api(`/shop/barbers/${input.id}`, { method: 'PATCH', json: input })
        : api('/shop/barbers', { method: 'POST', json: input }),
    invalidate,
    {
      onSuccess: (_result, input) => {
        toast(input.id ? 'Team member updated' : 'Barber added')
        setEditing(null)
      },
    },
  )

  const toggle = useApiMutation(
    (input: { id: string; active: boolean }) => api(`/shop/barbers/${input.id}`, { method: 'PATCH', json: { active: input.active } }),
    invalidate,
  )

  const remove = useApiMutation((id: string) => api(`/shop/barbers/${id}`, { method: 'DELETE' }), invalidate, {
    onSuccess: () => {
      setDeleting(null)
      toast('Removed from the team')
    },
  })

  if (me && !me.shop) {
    return (
      <div className="mx-auto max-w-[720px] p-8">
        <EmptyState
          icon={<Users />}
          title="No shop yet"
          description="Create your shop before adding barbers."
          action={
            <Link to="/shop" className="inline-flex h-9 items-center rounded-control bg-fg px-4 text-[13px] font-medium text-white">
              Set up my shop
            </Link>
          }
        />
      </div>
    )
  }

  const barbers = data?.items ?? []

  const openNew = () => {
    setName('')
    setTitle('Barber')
    setPhone('')
    setEditing('new')
  }

  const openEdit = (barber: Barber) => {
    setName(barber.name)
    setTitle(barber.title)
    setPhone(barber.phone ?? '')
    setEditing(barber)
  }

  return (
    <div className="mx-auto max-w-[900px] p-5 sm:p-8">
      <PageHeader
        title="Team"
        subtitle="Each active barber gets their own chair and their own free slots."
        actions={
          <Button variant="primary" onClick={openNew}>
            <Plus /> Add barber
          </Button>
        }
      />

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-[92px] rounded-card" />)}

        {barbers.map((barber) => (
          <Card key={barber.id} className="flex items-center gap-3 p-4">
            <Avatar name={barber.name} hue={barber.hue} size={44} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-[14px] font-medium">
                {barber.name}
                {!barber.active && <Badge tone="neutral">Paused</Badge>}
              </p>
              <p className="truncate text-[12px] text-faint">{barber.title}</p>
              <p className="mt-1 flex items-center gap-2 text-[11.5px] text-muted">
                {barber.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3" /> {barber.phone}
                  </span>
                )}
                <span>{barber.bookings} cuts</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Button size="icon-sm" variant="ghost" aria-label={`Edit ${barber.name}`} onClick={() => openEdit(barber)}>
                <Pencil />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label={`Remove ${barber.name}`} onClick={() => setDeleting(barber)}>
                <Trash2 />
              </Button>
            </div>
            <Button size="sm" onClick={() => toggle.mutate({ id: barber.id, active: !barber.active })}>
              {barber.active ? 'Pause' : 'Resume'}
            </Button>
          </Card>
        ))}
      </div>

      {!isLoading && barbers.length === 0 && (
        <EmptyState
          icon={<Scissors />}
          title="No barbers yet"
          description="Add the barbers who work your chairs so customers can pick them."
          action={<Button onClick={openNew}>Add barber</Button>}
        />
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add a barber' : 'Edit barber'}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={save.isPending}
              disabled={!name.trim()}
              onClick={() =>
                save.mutate({
                  id: editing && editing !== 'new' ? editing.id : undefined,
                  name: name.trim(),
                  title: title.trim() || 'Barber',
                  phone,
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ustaad Aslam" maxLength={60} />
          </Field>
          <Field label="Role" hint="Shown to customers, e.g. Master barber or Fade specialist.">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={40} />
          </Field>
          <Field label="Mobile (optional)">
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" maxLength={40} />
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title={`Remove ${deleting?.name ?? 'barber'}?`}
        description="They stop taking new bookings. Past appointments keep their name."
        confirmLabel="Remove barber"
      />
    </div>
  )
}

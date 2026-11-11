import { CalendarDays, ShieldCheck, Store, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { CITIES } from '../../shared/types'
import { Avatar, Badge, Button, Card, Field, Input, PageHeader, Select, useToast } from '../components/ui'
import { api, useApiMutation, useMe } from '../lib/api'

export function Settings() {
  const { data: me } = useMe()
  const toast = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')

  useEffect(() => {
    if (!me?.profile) return
    setName(me.profile.name)
    setPhone(me.profile.phone ?? '')
    setCity(me.profile.city ?? '')
  }, [me])

  const save = useApiMutation(
    () => api('/me', { method: 'PATCH', json: { name, phone, city: city || null } }),
    ['me'],
    { onSuccess: () => toast('Profile saved') },
  )

  // Reachable only when signed in (see App.tsx); the guard covers the first paint.
  if (!me?.profile || !me.user) return null
  const profile = me.profile
  const user = me.user

  const roles = [
    { label: 'Customer', detail: 'Book chairs anywhere in Pakistan', active: true, to: '/', icon: <CalendarDays /> },
    {
      label: me.shop ? `Shop owner · ${me.shop.name}` : 'Shop owner',
      detail: me.shop ? `${me.shop.area}, ${me.shop.city} · ${me.shop.status}` : 'List your barbershop and take bookings',
      active: Boolean(me.shop),
      to: '/shop',
      icon: <Store />,
    },
    { label: 'Platform admin', detail: 'Approve shops, audit the marketplace', active: profile.isAdmin, to: '/admin', icon: <ShieldCheck /> },
  ]

  return (
    <div className="mx-auto max-w-[760px] p-5 sm:p-8">
      <PageHeader title="Account" subtitle="Your profile, roles and connections." />

      <section className="mt-6">
        <div className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-surface p-4">
          <Avatar name={profile.name || user.email || 'You'} hue={158} src={user.picture} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{profile.name}</p>
            {profile.email && <p className="truncate text-[13px] text-muted">{profile.email}</p>}
          </div>
          {me.capabilities.auth === 'freebuff' ? (
            <form method="post" action="/auth/freebuff/signout">
              <input type="hidden" name="returnTo" value="/" />
              <Button type="submit">Sign out</Button>
            </form>
          ) : (
            <Badge tone="warning">Development user</Badge>
          )}
        </div>
        {me.capabilities.auth === 'development' && (
          <p className="mt-2 text-[12.5px] text-faint">
            Sign in with Freebuff is not configured yet — this is the loopback development account. Set FREEBUFF_CLIENT_ID to use real
            accounts.
          </p>
        )}
      </section>

      <Card className="mt-6 p-5">
        <h2 className="text-[14px] font-semibold">Profile</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Full name" className="sm:col-span-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          </Field>
          <Field label="Mobile number" hint="Used to pre-fill bookings so shops can confirm.">
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" maxLength={40} placeholder="0300 1234567" />
          </Field>
          <Field label="City">
            <Select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">Not set</option>
              {CITIES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11.5px] text-faint">Only the shops you book with can see these details.</p>
          <Button variant="primary" loading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate(undefined)}>
            Save profile
          </Button>
        </div>
      </Card>

      <section className="mt-6">
        <h2 className="text-[14px] font-semibold">Your access</h2>
        <div className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
          {roles.map((role) => (
            <div key={role.label} className="flex items-center gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-bg text-[#173d33] [&_svg]:size-4">{role.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{role.label}</p>
                <p className="truncate text-[12px] capitalize text-muted">{role.detail}</p>
              </div>
              {role.active ? <Badge tone="success" dot>Active</Badge> : <Badge tone="neutral">Not set up</Badge>}
              {role.active && role.to && (
                <Link to={role.to} className="text-[12.5px] font-medium text-muted hover:text-fg">
                  Open
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-[14px] font-semibold">Connections</h2>
        <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
          {[
            ['Database', me.capabilities.database, 'D1 via the DB binding'],
            ['Sign in with Freebuff', me.capabilities.auth === 'freebuff', 'FREEBUFF_CLIENT_ID'],
            ['Payments', false, 'Cash / Easypaisa at the chair — no gateway connected'],
          ].map(([label, ok, detail]) => (
            <li key={label as string} className="flex h-[52px] items-center gap-3 px-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{label}</span>
                <span className="block truncate text-[12px] text-faint">{detail}</span>
              </span>
              <Badge tone={ok ? 'success' : 'neutral'} dot>
                {ok ? 'Connected' : 'Not connected'}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 flex items-center gap-1.5 text-[11.5px] text-faint">
        <Wallet className="size-3.5" /> All prices on Ustaad are in Pakistani rupees (PKR), payable at the shop.
      </p>
    </div>
  )
}

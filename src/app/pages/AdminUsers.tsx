import { ShieldCheck, Store, UserRound } from 'lucide-react'

import { Avatar, Badge, Card, EmptyState, PageHeader, Skeleton } from '../components/ui'
import { useAdminUsers } from '../lib/api'
import { joinedLabel } from '../lib/format'

export function AdminUsers() {
  const { data, isLoading } = useAdminUsers()
  const users = data?.items ?? []

  return (
    <div className="mx-auto max-w-[1000px] p-5 sm:p-8">
      <PageHeader title="People" subtitle="Everyone with an account: customers, shop owners and admins." />

      <Card className="mt-5">
        <div className="hidden border-b border-line px-4 py-2.5 text-[11px] uppercase tracking-[0.08em] text-faint sm:grid sm:grid-cols-[1.6fr_1fr_90px_90px_110px] sm:gap-3">
          <span>Person</span>
          <span>Role</span>
          <span className="text-right">Shops</span>
          <span className="text-right">Bookings</span>
          <span className="text-right">Joined</span>
        </div>

        {isLoading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-11 rounded-tile" />
            ))}
          </div>
        )}

        {users.map((user) => (
          <div
            key={user.sub}
            className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-[1.6fr_1fr_90px_90px_110px]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={user.name} hue={user.isAdmin ? 158 : 210} size={30} />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium">{user.name}</p>
                <p className="truncate text-[11.5px] text-faint">{user.email ?? 'no email on file'}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {user.isAdmin && (
                <Badge tone="accent">
                  <ShieldCheck className="size-3" /> Admin
                </Badge>
              )}
              {user.shops > 0 && (
                <Badge tone="info">
                  <Store className="size-3" /> Shop
                </Badge>
              )}
              {!user.isAdmin && user.shops === 0 && (
                <Badge tone="neutral">
                  <UserRound className="size-3" /> Customer
                </Badge>
              )}
            </div>
            <span className="text-right text-[12.5px] tabular-nums sm:text-right">{user.shops}</span>
            <span className="text-right text-[12.5px] tabular-nums">{user.bookings}</span>
            <span className="hidden text-right text-[12px] text-faint sm:block">{joinedLabel(user.joinedAt)}</span>
          </div>
        ))}

        {!isLoading && users.length === 0 && <EmptyState icon={<UserRound />} title="No accounts yet" description="People appear here after their first sign-in." />}
      </Card>

      <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
        Admins are set with the ADMIN_EMAILS secret (comma separated) on the deployment, so nobody can promote themselves from the app.
      </p>
    </div>
  )
}

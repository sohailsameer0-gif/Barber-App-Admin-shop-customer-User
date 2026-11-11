import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { Shell } from './components/Shell'
import { Spinner, ToastProvider } from './components/ui'
import { ApiError, useMe } from './lib/api'
import { AdminOverview } from './pages/AdminOverview'
import { AdminShops } from './pages/AdminShops'
import { AdminUsers } from './pages/AdminUsers'
import { Bookings } from './pages/Bookings'
import { Home } from './pages/Home'
import { Settings } from './pages/Settings'
import { SetupNeeded, SignIn } from './pages/SignIn'
import { ShopAppointments } from './pages/ShopAppointments'
import { ShopDashboard } from './pages/ShopDashboard'
import { ShopDetail } from './pages/ShopDetail'
import { ShopServices } from './pages/ShopServices'
import { ShopSettings } from './pages/ShopSettings'
import { ShopTeam } from './pages/ShopTeam'

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
})

/** Customers browse as guests; only the owner half of the app needs an account. */
function OwnerOnly({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  if (!signedIn) return <SignIn />
  return <>{children}</>
}

function Gate() {
  const me = useMe()
  if (me.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    )
  }
  if (me.error instanceof ApiError && me.error.status === 503) return <SetupNeeded message={me.error.message} />
  if (me.error) return <SetupNeeded message={me.error.message} />
  if (!me.data) return null

  const signedIn = Boolean(me.data.user)
  const admin = Boolean(me.data.profile?.isAdmin)
  const owner = (page: ReactNode) => <OwnerOnly signedIn={signedIn}>{page}</OwnerOnly>

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="shops/:id" element={<ShopDetail />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="signin" element={<SignIn />} />
        <Route path="shop" element={owner(<ShopDashboard />)} />
        <Route path="shop/appointments" element={owner(<ShopAppointments />)} />
        <Route path="shop/services" element={owner(<ShopServices />)} />
        <Route path="shop/team" element={owner(<ShopTeam />)} />
        <Route path="shop/settings" element={owner(<ShopSettings />)} />
        <Route path="admin" element={admin ? <AdminOverview /> : owner(<Navigate to="/" replace />)} />
        <Route path="admin/shops" element={admin ? <AdminShops /> : owner(<Navigate to="/" replace />)} />
        <Route path="admin/users" element={admin ? <AdminUsers /> : owner(<Navigate to="/" replace />)} />
        <Route path="settings" element={owner(<Settings />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

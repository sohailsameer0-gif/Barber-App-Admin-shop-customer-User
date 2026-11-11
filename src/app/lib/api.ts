import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  AdminOverview,
  AdminShop,
  AdminUser,
  Appointment,
  Barber,
  GuestBooking,
  Me,
  Review,
  Service,
  ShopDashboardResponse,
  ShopDetailResponse,
  ShopSummary,
  ShopsResponse,
  Slot,
} from '../../shared/types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers: {
      accept: 'application/json',
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  if (!response.ok) {
    let message = response.statusText
    let code: string | undefined
    try {
      const body = (await response.json()) as { error?: string; message?: string }
      message = body.message ?? body.error ?? message
      code = body.error
    } catch {
      /* no body */
    }
    throw new ApiError(response.status, message, code)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

// Queries

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/me'), retry: false, staleTime: 30_000 })

export interface ShopsQuery {
  q?: string
  city?: string
  sort?: 'rating' | 'price' | 'new'
}
export const useShops = (query: ShopsQuery) =>
  useQuery({
    queryKey: ['shops', query],
    queryFn: () => {
      const params = new URLSearchParams()
      if (query.q) params.set('q', query.q)
      if (query.city) params.set('city', query.city)
      if (query.sort) params.set('sort', query.sort)
      return api<ShopsResponse>(`/shops?${params}`)
    },
    placeholderData: (previous) => previous,
  })

export const useShop = (id: string | undefined) =>
  useQuery({ queryKey: ['shop', id], queryFn: () => api<ShopDetailResponse>(`/shops/${id}`), enabled: Boolean(id) })

export const useAvailability = (
  shopId: string | undefined,
  params: { date: string; serviceId: string | null; barberId: string },
  enabled = true,
) =>
  useQuery({
    queryKey: ['availability', shopId, params.date, params.serviceId, params.barberId],
    queryFn: () => {
      const search = new URLSearchParams({ date: params.date })
      if (params.serviceId) search.set('serviceId', params.serviceId)
      if (params.barberId) search.set('barberId', params.barberId)
      return api<{ slots: Slot[]; closed: boolean }>(`/shops/${shopId}/availability?${search}`)
    },
    enabled: Boolean(shopId && params.serviceId && enabled),
    staleTime: 15_000,
  })

export const useShopAvailability = (params: { date: string; serviceId: string | null; barberId: string }, enabled = true) =>
  useQuery({
    queryKey: ['shop-availability', params.date, params.serviceId, params.barberId],
    queryFn: () => {
      const search = new URLSearchParams({ date: params.date })
      if (params.serviceId) search.set('serviceId', params.serviceId)
      if (params.barberId) search.set('barberId', params.barberId)
      return api<{ slots: Slot[]; closed: boolean }>(`/shop/availability?${search}`)
    },
    enabled: Boolean(params.serviceId && enabled),
    staleTime: 10_000,
  })

export const useMyBookings = (enabled = true) =>
  useQuery({ queryKey: ['bookings'], queryFn: () => api<{ upcoming: Appointment[]; past: Appointment[] }>('/bookings'), enabled })

/** Trades the codes saved on this device for the guest's live bookings. */
export const useGuestBookings = (codes: string[]) =>
  useQuery({
    queryKey: ['guest-bookings', codes.join(',')],
    queryFn: () => api<{ appointments: Appointment[]; missing?: string[] }>('/bookings/lookup', { method: 'POST', json: { tokens: codes } }),
    enabled: codes.length > 0,
    staleTime: 10_000,
  })

export const useShopDashboard = (enabled = true) =>
  useQuery({ queryKey: ['shop-dashboard'], queryFn: () => api<ShopDashboardResponse>('/shop'), enabled, retry: false })

export const useShopAppointments = (date: string) =>
  useQuery({ queryKey: ['shop-appointments', date], queryFn: () => api<{ items: Appointment[] }>(`/shop/appointments?date=${date}`) })

export const useShopServices = () => useQuery({ queryKey: ['shop-services'], queryFn: () => api<{ items: Service[] }>('/shop/services') })
export const useShopBarbers = () => useQuery({ queryKey: ['shop-barbers'], queryFn: () => api<{ items: Barber[] }>('/shop/barbers') })
export const useShopReviews = () => useQuery({ queryKey: ['shop-reviews'], queryFn: () => api<{ items: Review[] }>('/shop/reviews') })

export const useAdminOverview = (enabled = true) =>
  useQuery({ queryKey: ['admin-overview'], queryFn: () => api<AdminOverview>('/admin/overview'), enabled, retry: false })
export const useAdminShops = (status: string) =>
  useQuery({ queryKey: ['admin-shops', status], queryFn: () => api<{ items: AdminShop[] }>(`/admin/shops${status ? `?status=${status}` : ''}`) })
export const useAdminUsers = () => useQuery({ queryKey: ['admin-users'], queryFn: () => api<{ items: AdminUser[] }>('/admin/users') })

// Mutations

export function useInvalidate() {
  const client = useQueryClient()
  return (...keys: string[]) => Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: [key] })))
}

export function useApiMutation<TInput, TResult>(
  run: (input: TInput) => Promise<TResult>,
  invalidates: string[],
  options?: { onSuccess?: (result: TResult, input: TInput) => void; onError?: (error: unknown, input: TInput) => void },
) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: run,
    onSuccess: async (result, input) => {
      await invalidate(...invalidates)
      options?.onSuccess?.(result, input)
    },
    onError: (error, input) => options?.onError?.(error, input),
  })
}

export type { AdminOverview, AdminShop, AdminUser, Appointment, Barber, GuestBooking, Me, Review, Service, ShopDetailResponse, ShopSummary, Slot }

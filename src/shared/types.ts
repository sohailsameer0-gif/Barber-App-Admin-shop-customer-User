// Types shared by the Worker (src/worker) and the app (src/app).

export const CURRENCY = 'PKR'
export const TIME_ZONE = 'Asia/Karachi'
export const PLATFORM_FEE_PERCENT = 10

export const CITIES = [
  'Karachi',
  'Lahore',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
  'Hyderabad',
  'Bahawalpur',
] as const

export type City = (typeof CITIES)[number]

export type ShopStatus = 'pending' | 'approved' | 'suspended'
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export const APPOINTMENT_STATUSES: { key: AppointmentStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'no_show', label: 'No-show' },
]

export interface ShopSummary {
  id: string
  name: string
  city: string
  area: string
  address: string | null
  phone: string | null
  description: string | null
  hue: number
  opensAt: string
  closesAt: string
  status: ShopStatus
  rating: number | null
  reviewCount: number
  priceFrom: number | null
  barberCount: number
  serviceCount: number
  createdAt: number
}

export interface Service {
  id: string
  shopId: string
  name: string
  pricePkr: number
  durationMin: number
  active: boolean
  sort: number
}

export interface Barber {
  id: string
  shopId: string
  name: string
  title: string
  phone: string | null
  active: boolean
  hue: number
  rating: number | null
  bookings: number
}

export interface Review {
  id: string
  shopId: string
  customerName: string
  rating: number
  body: string | null
  createdAt: number
  serviceName: string | null
}

export interface Appointment {
  id: string
  shopId: string
  shopName?: string | null
  shopArea?: string | null
  shopCity?: string | null
  shopHue?: number | null
  barberId: string | null
  barberName?: string | null
  serviceId: string | null
  serviceName?: string | null
  customerSub: string
  customerName: string
  customerPhone: string | null
  startsAt: number
  durationMin: number
  pricePkr: number
  status: AppointmentStatus
  notes: string | null
  reviewed?: boolean
  createdAt: number
  updatedAt: number
  /** Guest bookings only: the code that unlocks cancel on this device. */
  guestToken?: string | null
  code?: string | null
}

export interface Slot {
  time: string
  startsAt: number
  available: boolean
}

export interface MeProfile {
  name: string
  email: string | null
  phone: string | null
  city: string | null
  isAdmin: boolean
}

/** `user` and `profile` are null for guests, who book without an account. */
export interface Me {
  user: { sub: string; name?: string; email?: string; picture?: string } | null
  profile: MeProfile | null
  shop: { id: string; name: string; status: ShopStatus; city: string; area: string } | null
  capabilities: { database: boolean; auth: 'freebuff' | 'development' }
}

export interface GuestBooking {
  appointment: Appointment
  guestToken: string | null
  code: string | null
}

export interface ShopsResponse {
  items: ShopSummary[]
  cities: { city: string; count: number }[]
}

export interface ShopDetailResponse {
  shop: ShopSummary
  services: Service[]
  barbers: Barber[]
  reviews: Review[]
}

export interface ShopStats {
  todayBookings: number
  todayRevenue: number
  weekRevenue: number
  monthRevenue: number
  pending: number
  rating: number | null
  reviewCount: number
  customers: number
}

export interface ShopDashboardResponse {
  shop: ShopSummary
  stats: ShopStats
  today: Appointment[]
  pending: Appointment[]
  weekSeries: { label: string; value: number }[]
  topServices: { name: string; count: number; revenue: number }[]
}

export interface AdminOverview {
  kpis: {
    gmv: number
    commission: number
    bookings: number
    completed: number
    pendingShops: number
    approvedShops: number
    customers: number
    avgRating: number | null
  }
  series: { label: string; value: number }[]
  cities: { city: string; shops: number; revenue: number }[]
  topShops: { id: string; name: string; city: string; revenue: number; bookings: number; rating: number | null }[]
  recent: Appointment[]
}

export interface AdminShop {
  id: string
  name: string
  city: string
  area: string
  ownerSub: string
  ownerEmail: string | null
  ownerName: string | null
  status: ShopStatus
  hue: number
  rating: number | null
  reviewCount: number
  revenue: number
  bookings: number
  createdAt: number
}

export interface AdminUser {
  sub: string
  name: string
  email: string | null
  isAdmin: boolean
  shops: number
  bookings: number
  joinedAt: number
}

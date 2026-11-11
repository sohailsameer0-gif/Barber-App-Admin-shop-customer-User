import { DEV_USER } from './auth'
import { id, now, pkStamp, todayKey } from './db'
import { ensureSeededProfile } from './roles'

// Demo marketplace, created once when the shops table is empty. The first shop
// belongs to the local development user so the shop dashboard is populated
// locally; on a deployed site a new owner starts with the onboarding form.

type SeedService = [name: string, price: number, minutes: number]
type SeedBarber = [name: string, title: string]
type SeedReview = [name: string, rating: number, body: string]

interface SeedShop {
  name: string
  city: string
  area: string
  address: string
  phone: string
  description: string
  hue: number
  opensAt: string
  closesAt: string
  owner: { sub: string; name: string; email: string }
  services: SeedService[]
  barbers: SeedBarber[]
  reviews: SeedReview[]
}

const COMMON_SERVICES: SeedService[] = [
  ['Haircut', 800, 30],
  ['Beard Trim', 400, 20],
  ['Haircut + Beard', 1100, 45],
  ['Clean Shave', 500, 25],
  ['Face Cleanup', 1200, 40],
  ['Head Massage', 600, 20],
]

const SHOPS: SeedShop[] = [
  {
    name: 'Ustaad Studio',
    city: 'Lahore',
    area: 'Gulberg III',
    address: '12-C Main Boulevard, Gulberg III',
    phone: '0300 8451234',
    description: 'A quiet, air-conditioned studio for a proper cut and hot-towel shave. Walk-ins welcome, appointments preferred.',
    hue: 158,
    opensAt: '10:00',
    closesAt: '21:00',
    owner: { sub: DEV_USER.sub, name: DEV_USER.name ?? 'Bilal Ahmed', email: DEV_USER.email ?? 'bilal@ustaad.pk' },
    services: [...COMMON_SERVICES, ['Hair Colour', 2500, 60]],
    barbers: [
      ['Ustaad Aslam', 'Master barber'],
      ['Shahid Bhai', 'Senior barber'],
      ['Hamza', 'Barber'],
    ],
    reviews: [
      ['Ahmed Raza', 5, 'Aslam bhai gave me the cleanest fade I have had in Lahore. Proper hot towel finish.'],
      ['Usman Tariq', 5, 'Booked on the app, walked in, no wait. Beard trim was sharp.'],
      ['Zain Ali', 4, 'Good cut and fair price. Parking on the boulevard is the only pain.'],
    ],
  },
  {
    name: "Gentlemen's Den",
    city: 'Karachi',
    area: 'Clifton Block 5',
    address: 'Shop 4, Zamzama Commercial Lane',
    phone: '0321 2778890',
    description: 'Karachi’s go-to for sharp fades, beard sculpting and a chilled-out atmosphere. Home service available on request.',
    hue: 212,
    opensAt: '11:00',
    closesAt: '22:00',
    owner: { sub: 'demo-owner-clifton', name: 'Faisal Karim', email: 'faisal@example.pk' },
    services: [
      ['Skin Fade', 1200, 40],
      ['Beard Sculpt', 600, 25],
      ['Fade + Beard', 1600, 55],
      ['Luxury Shave', 900, 30],
      ['Hair Wash + Styling', 700, 20],
      ['Kids Cut', 600, 25],
    ],
    barbers: [
      ['Faisal Bhai', 'Master barber'],
      ['Naveed', 'Fade specialist'],
      ['Adeel', 'Barber'],
    ],
    reviews: [
      ['Hamza Sheikh', 5, 'Naveed’s fades are unreal. Book the 8pm slot, it is the quietest.'],
      ['Bilal Qureshi', 4, 'Clean shop, good work, slightly pricey for the area.'],
    ],
  },
  {
    name: 'Sherdil Grooming',
    city: 'Lahore',
    area: 'DHA Phase 5',
    address: 'Y-Block Commercial, DHA Phase 5',
    phone: '0333 9182244',
    description: 'Family-friendly grooming lounge: cuts, beard oil, facials and quick service for the school run.',
    hue: 22,
    opensAt: '09:00',
    closesAt: '21:00',
    owner: { sub: 'demo-owner-dha', name: 'Kamran Butt', email: 'kamran@example.pk' },
    services: [
      ['Haircut', 900, 30],
      ['Beard Trim', 450, 20],
      ['Haircut + Beard', 1250, 45],
      ['Kids Cut', 500, 20],
      ['Face Cleanup', 1500, 45],
    ],
    barbers: [
      ['Kamran', 'Master barber'],
      ['Saad', 'Senior barber'],
    ],
    reviews: [
      ['Saad Malik', 5, 'Took my son for his first proper haircut. Patient and quick.'],
      ['Fahad Iqbal', 4, 'Solid cut. The loyalty card is a nice touch.'],
      ['Ahsan Javed', 5, 'Best beard trim in DHA, hands down.'],
    ],
  },
  {
    name: 'Crown & Comb',
    city: 'Islamabad',
    area: 'F-7 Markaz',
    address: 'Ground floor, F-7 Markaz',
    phone: '0345 5567123',
    description: 'A modern barbering floor in the heart of F-7. Appointments recommended for weekend slots.',
    hue: 268,
    opensAt: '10:00',
    closesAt: '20:00',
    owner: { sub: 'demo-owner-f7', name: 'Haris Nawaz', email: 'haris@example.pk' },
    services: [
      ['Classic Cut', 1000, 30],
      ['Beard Trim', 500, 20],
      ['Cut + Beard', 1400, 50],
      ['Hot Towel Shave', 700, 30],
      ['Hair Colour', 2800, 60],
    ],
    barbers: [
      ['Haris', 'Barber'],
      ['Zubair', 'Barber'],
    ],
    reviews: [
      ['Umer Farooq', 5, 'Great experience, very professional. Say yes to the hot towel.'],
      ['Danish Ali', 4, 'Bit busy on Saturday but the cut was worth it.'],
    ],
  },
  {
    name: 'Saleem Hair Cutting Salon',
    city: 'Rawalpindi',
    area: 'Saddar',
    address: 'Bank Road, opposite Saddar Bazaar',
    phone: '0312 4456677',
    description: 'Three generations of barbers on Bank Road. Old-school cuts and shaves at honest prices.',
    hue: 190,
    opensAt: '09:00',
    closesAt: '22:00',
    owner: { sub: 'demo-owner-saddar', name: 'Saleem Akhtar', email: 'saleem@example.pk' },
    services: [
      ['Haircut', 400, 25],
      ['Beard Trim', 200, 15],
      ['Cut + Beard', 550, 40],
      ['Clean Shave', 300, 20],
      ['Oil Massage', 450, 20],
    ],
    barbers: [
      ['Saleem Bhai', 'Master barber'],
      ['Rashid', 'Barber'],
      ['Waqas', 'Barber'],
    ],
    reviews: [
      ['Imran Shah', 5, 'Forty years of experience in that shop. You cannot beat Saleem bhai.'],
      ['Kashif Mehmood', 4, 'Cheap, fast, always good.'],
    ],
  },
  {
    name: 'The Ustaad Chair',
    city: 'Faisalabad',
    area: 'D Ground',
    address: 'D Ground, People’s Colony No. 1',
    phone: '0301 7789123',
    description: 'Clean cuts and beard styling for the Faisalabad crowd. Walk-in chair available all day.',
    hue: 340,
    opensAt: '10:00',
    closesAt: '21:30',
    owner: { sub: 'demo-owner-fsd', name: 'Adeel Rehman', email: 'adeel@example.pk' },
    services: [
      ['Haircut', 600, 30],
      ['Beard Trim', 300, 20],
      ['Cut + Beard', 800, 45],
      ['Face Cleanup', 900, 40],
    ],
    barbers: [
      ['Adeel', 'Barber'],
      ['Sohail', 'Barber'],
    ],
    reviews: [['Noman Butt', 4, 'Good value. Adeel understands what you want quickly.']],
  },
  {
    name: 'Multan Barber Co.',
    city: 'Multan',
    area: 'Cantt',
    address: 'Near Cantt Market, Multan Cantt',
    phone: '0334 2211445',
    description: 'Fresh studio in Multan Cantt with imported clippers and a proper beard bar.',
    hue: 40,
    opensAt: '10:00',
    closesAt: '21:00',
    owner: { sub: 'demo-owner-multan', name: 'Taimoor Gill', email: 'taimoor@example.pk' },
    services: [
      ['Haircut', 550, 30],
      ['Beard Trim', 300, 20],
      ['Cut + Beard', 750, 45],
      ['Head Massage', 400, 15],
    ],
    barbers: [['Taimoor', 'Barber'], ['Sufyan', 'Barber']],
    reviews: [['Adeel Ahmad', 5, 'New shop but very professional. Good AC, good music.']],
  },
  {
    name: 'Peshawar Cut Club',
    city: 'Peshawar',
    area: 'University Road',
    address: 'University Road, near Islamia College',
    phone: '0311 8877665',
    description: 'Student-friendly barbers next to University Road. Quick cuts between classes.',
    hue: 120,
    opensAt: '09:30',
    closesAt: '21:00',
    owner: { sub: 'demo-owner-pesh', name: 'Ihtisham Khan', email: 'ihtisham@example.pk' },
    services: [
      ['Haircut', 450, 25],
      ['Beard Trim', 250, 15],
      ['Cut + Beard', 650, 40],
    ],
    barbers: [['Ihtisham', 'Barber'], ['Shah Faisal', 'Barber']],
    reviews: [['Yasir Afridi', 4, 'Good quick cut, very reasonably priced for students.']],
  },
  {
    name: 'Quetta Sharp Studio',
    city: 'Quetta',
    area: 'Jinnah Road',
    address: 'Jinnah Road, near Prince Plaza',
    phone: '0345 9988112',
    description: 'Sharp fades and beard work on Jinnah Road, with private chairs for families.',
    hue: 300,
    opensAt: '10:00',
    closesAt: '20:30',
    owner: { sub: 'demo-owner-quetta', name: 'Naseer Baloch', email: 'naseer@example.pk' },
    services: [
      ['Haircut', 500, 30],
      ['Beard Trim', 300, 20],
      ['Cut + Beard', 700, 45],
    ],
    barbers: [['Naseer', 'Barber']],
    reviews: [],
  },
]

const CUSTOMER_NAMES = ['Ahmed Raza', 'Usman Tariq', 'Hamza Sheikh', 'Zain Ali', 'Fahad Iqbal', 'Saad Malik', 'Imran Shah', 'Danish Ali', 'Umer Farooq', 'Kashif Mehmood']

export async function seedIfEmpty(db: D1Database): Promise<void> {
  const count = await db.prepare(`SELECT COUNT(*) AS n FROM shops`).first<{ n: number }>()
  if (Number(count?.n ?? 0) > 0) return

  const t = now()
  const today = todayKey()
  const statements: D1PreparedStatement[] = []
  const shops: { id: string; serviceIds: string[]; barberIds: string[]; serviceNames: string[]; servicePrices: number[]; serviceDurations: number[] }[] = []

  for (const shop of SHOPS) {
    const shopId = id()
    await ensureSeededProfile(db, shop.owner.sub, shop.owner.name, shop.owner.email)
    statements.push(
      db
        .prepare(
          `INSERT INTO shops (id, owner_sub, name, city, area, address, phone, description, hue, opens_at, closes_at, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`,
        )
        .bind(shopId, shop.owner.sub, shop.name, shop.city, shop.area, shop.address, shop.phone, shop.description, shop.hue, shop.opensAt, shop.closesAt, t, t),
    )
    const serviceIds: string[] = []
    const serviceNames: string[] = []
    const servicePrices: number[] = []
    const serviceDurations: number[] = []
    shop.services.forEach(([name, price, minutes], index) => {
      const serviceId = id()
      serviceIds.push(serviceId)
      serviceNames.push(name)
      servicePrices.push(price)
      serviceDurations.push(minutes)
      statements.push(
        db
          .prepare(`INSERT INTO services (id, shop_id, name, price_pkr, duration_min, active, sort, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`)
          .bind(serviceId, shopId, name, price, minutes, index, t),
      )
    })
    const barberIds: string[] = []
    shop.barbers.forEach(([name, title], index) => {
      const barberId = id()
      barberIds.push(barberId)
      statements.push(
        db
          .prepare(`INSERT INTO barbers (id, shop_id, name, title, phone, active, hue, created_at) VALUES (?, ?, ?, ?, NULL, 1, ?, ?)`)
          .bind(barberId, shopId, name, title, (shop.hue + index * 24) % 360, t),
      )
    })
    shops.push({ id: shopId, serviceIds, barberIds, serviceNames, servicePrices, serviceDurations })
  }

  await db.batch(statements)

  // Reviews, spread over the last three months.
  const reviewStatements: D1PreparedStatement[] = []
  SHOPS.forEach((shop, index) => {
    const entry = shops[index]
    shop.reviews.forEach(([name, rating, body], r) => {
      reviewStatements.push(
        db
          .prepare(`INSERT INTO reviews (id, shop_id, appointment_id, customer_sub, customer_name, rating, body, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`)
          .bind(id(), entry.id, `seed-reviewer-${index}-${r}`, name, rating, body, t - (index * 3 + r + 1) * 86_400_000 / 2),
      )
    })
  })
  await db.batch(reviewStatements)

  // A day of business for the development owner's shop, so the dashboard has
  // something to show: past (completed), now (confirmed) and later (pending).
  const own = shops[0]
  const apptStatements: D1PreparedStatement[] = []
  const todayPlan: [number, number, number][] = [
    // [minutes from midnight, barber index, service index]
    [600, 0, 0],
    [660, 1, 2],
    [720, 2, 1],
    [780, 0, 2],
    [840, 1, 4],
    [1020, 0, 0],
    [1080, 2, 3],
    [1140, 1, 0],
  ]
  todayPlan.forEach(([minutes, barber, service], i) => {
    const startsAt = pkStamp(today, minutes)
    // Slots that already passed read as served business; the rest stay live.
    const status = startsAt < t - 15 * 60_000 ? 'completed' : i % 2 === 0 ? 'confirmed' : 'pending'
    apptStatements.push(
      db
        .prepare(
          `INSERT INTO appointments (id, shop_id, barber_id, service_id, customer_sub, customer_name, customer_phone, starts_at, duration_min, price_pkr, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        )
        .bind(
          id(),
          own.id,
          own.barberIds[barber],
          own.serviceIds[service],
          `seed-customer-${i}`,
          CUSTOMER_NAMES[i % CUSTOMER_NAMES.length],
          `0300 000${1000 + i}`,
          startsAt,
          own.serviceDurations[service],
          own.servicePrices[service],
          status,
          t - 3_600_000,
          t - 3_600_000,
        ),
    )
  })

  // The development user's own bookings elsewhere (one finished, so the review
  // flow can be tried immediately).
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  const other = shops[1]
  const third = shops[2]
  apptStatements.push(
    db
      .prepare(
        `INSERT INTO appointments (id, shop_id, barber_id, service_id, customer_sub, customer_name, customer_phone, starts_at, duration_min, price_pkr, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'Please keep the top long', ?, ?)`,
      )
      .bind(id(), other.id, other.barberIds[0], other.serviceIds[2], DEV_USER.sub, 'Bilal Ahmed', '0300 1234567', pkStamp(tomorrow, 1140), 55, 1600, t - 86_400_000, t - 86_400_000),
    db
      .prepare(
        `INSERT INTO appointments (id, shop_id, barber_id, service_id, customer_sub, customer_name, customer_phone, starts_at, duration_min, price_pkr, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`,
      )
      .bind(id(), third.id, third.barberIds[0], third.serviceIds[3], DEV_USER.sub, 'Bilal Ahmed', '0300 1234567', pkStamp(tomorrow, 1080), 45, 900, t - 90_000_000, t - 90_000_000),
    db
      .prepare(
        `INSERT INTO appointments (id, shop_id, barber_id, service_id, customer_sub, customer_name, customer_phone, starts_at, duration_min, price_pkr, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', NULL, ?, ?)`,
      )
      .bind(id(), other.id, other.barberIds[1], other.serviceIds[0], DEV_USER.sub, 'Bilal Ahmed', '0300 1234567', pkStamp(today, 600) - 3 * 86_400_000, 40, 1200, t - 5 * 86_400_000, t - 5 * 86_400_000),
  )
  await db.batch(apptStatements)

  // A few completed bookings across other shops so admin totals are not empty.
  const fillerStatements: D1PreparedStatement[] = []
  for (let d = 1; d <= 20; d++) {
    const shopIndex = 1 + (d % (shops.length - 1))
    const entry = shops[shopIndex]
    const serviceIndex = d % entry.serviceIds.length
    const date = new Date(Date.parse(`${today}T00:00:00Z`) - d * 86_400_000).toISOString().slice(0, 10)
    fillerStatements.push(
      db
        .prepare(
          `INSERT INTO appointments (id, shop_id, barber_id, service_id, customer_sub, customer_name, customer_phone, starts_at, duration_min, price_pkr, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', NULL, ?, ?)`,
        )
        .bind(
          id(),
          entry.id,
          entry.barberIds[d % entry.barberIds.length],
          entry.serviceIds[serviceIndex],
          `seed-customer-filler-${d}`,
          CUSTOMER_NAMES[(d + 3) % CUSTOMER_NAMES.length],
          '0300 5556677',
          pkStamp(date, 600 + (d % 8) * 60),
          30,
          entry.servicePrices[serviceIndex],
          t - d * 86_400_000,
          t - d * 86_400_000,
        ),
    )
  }
  await db.batch(fillerStatements)
}

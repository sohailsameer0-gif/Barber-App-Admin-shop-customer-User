# Ustaad — barber booking for Pakistan

A three-sided barbershop marketplace: customers find and book a chair, shop
owners run their chairs, and platform admins approve shops and watch the
marketplace. Prices are in Pakistani rupees (PKR), every time is Asia/Karachi,
and the demo marketplace ships with shops across Karachi, Lahore, Islamabad,
Rawalpindi, Faisalabad, Multan, Peshawar and Quetta.

Runs on Freebuff Sites: Vite + React client, Hono API on a Cloudflare Worker,
D1 for data and Sign in with Freebuff for accounts.

## Run it

```sh
bun install
bun run dev        # http://localhost:5173 with local D1 (Miniflare)
bun run build      # dist/client (assets) + dist/ustaad/index.js (Worker)
bun run typecheck
```

On localhost without a `FREEBUFF_CLIENT_ID`, you are signed in as the local
development user (Bilal Ahmed). For a cloud preview on a non-loopback host, put
`DEV_DEMO=1` in `.dev.vars` (never on a real deployment). That account is a customer, the owner of the
demo shop **Ustaad Studio**, and an admin, so all three sides can be explored
straight away. On a deployed site a new account starts as a customer and can
open a shop from **My shop**.

## The three roles

Customers need no account at all. Shop owners and admins sign in; one account
can hold all three roles and the segmented switch at the top of the sidebar
moves between them once you are signed in.

- **Customer (guest)** — browse approved shops by city/area, see services and
  rupee prices, real open chairs for the next 10 days, then book with just a
  name and mobile number, like a delivery checkout. The confirmation shows a
  short booking code; the code is kept in that browser and listed under **My
  bookings**, where it also cancels the chair. No email, no password, no
  account.
- **Shop owner** — a dashboard with today's chairs, collected rupees, a 7-day
  revenue chart, pending confirmations and most-booked services. Manage
  appointments (confirm, complete, no-show, cancel), add walk-ins, edit the
  service menu and team, and set opening hours. A new shop starts `pending`
  until an admin approves it, and cannot be booked before then.
- **Admin** — marketplace KPIs (gross booked value, 10% platform fee, bookings,
  customers, ratings), booked value over 14 days, revenue by city, top shops,
  a live booking feed, shop approval/suspension, and a people list.

## Money, time and booking rules

- Amounts are stored as whole rupees (`price_pkr`) and shown as `Rs 1,250`.
  Customers pay at the chair (cash or Easypaisa); no gateway is connected.
- Pakistan Standard Time is UTC+5 all year, so the Worker does plain offset
  arithmetic for day boundaries and slots instead of Intl on every row.
- Slots are generated from the shop's opening hours in 30-minute steps for the
  chosen service duration; a slot is offered only when a barber is free.
- A partial unique index (`barber_id`, `starts_at` where status is pending or
  confirmed) makes double-booking impossible even under a race; the API also
  re-checks availability and returns `409` with a friendly message.
- "Any barber" lets the server pick the first free chair.
- Guest bookings are ordinary appointment rows with a synthetic customer
  subject plus a single-use-lookup code in `guest_tokens`. The code never
  appears in shop or admin payloads, and it is the only way back into a guest
  booking, so losing it means losing the booking.

## Sign-in

Sign in with Freebuff guards only the owner half of the app (`/shop`, `/admin`,
`/api/shop`, `/api/admin`). Add an admin's email to the `ADMIN_EMAILS` secret
(comma-separated) to give them the console; nobody can promote themselves in
app. A Google sign-in can replace this later without touching the booking
flow, because customers never authenticate.

## Images

Shop cover photos live in `public/img/shops/` and are picked per shop from its
id, so no shop row carries a URL. They are from Unsplash under the Unsplash
License (free for commercial use, no attribution required).

## Where things are

- `src/worker/` — Hono API. `db.ts` owns the schema (created on first request),
  `slots.ts` the availability engine, `auth.ts` the Freebuff integration and
  loopback-only development user, `roles.ts` profile/owner/admin resolution,
  `seed.ts` the demo marketplace, `routes/*` the endpoints.
- `src/app/` — React app. `components/ui.tsx` holds primitives, `components/shop.tsx`
  the shop card/cover/status bits, `pages/*` the screens, `lib/api.ts` the
  TanStack Query hooks, `lib/format.ts` PKR and Pakistan-time formatting.
- `src/shared/types.ts` — the contract between the two.
- `src/styles.css` — warm paper + deep-green/brass tokens.

## Deploy on Freebuff Sites

1. `sites_create`, then `sites_add_storage` for D1 named `DB`.
2. `sites_enable_auth` (pass `http://localhost:5173` as the local origin while
   developing). Copy the development variables into `.dev.vars` (see
   `.dev.vars.example`) to use real accounts locally.
3. `bun run build`, then `sites_deploy` with `deploy.json`. The deploy injects
   `FREEBUFF_CLIENT_ID`, `FREEBUFF_ISSUER` and `APP_ORIGIN` and attaches `DB`.
4. Admin console access: set a secret named `ADMIN_EMAILS` on the site, with the
   comma-separated emails that should see it (for example
   `owner@example.com`). It is checked on every request, so nobody can promote
   themselves from the app. The loopback development user is always an admin.

If the database binding is missing the app says so instead of failing.

## Data model

`profiles` (one per account), `shops` (owner, city/area, hours, approval
status), `services` (price in PKR, duration), `barbers` (chairs), `appointments`
(customer, barber, service, Pakistan-time start, status) and `reviews` (one per
completed visit).

## Seed data

The first request seeds nine approved shops with menus, teams, reviews, a day of
business for Ustaad Studio and a few completed visits for admin totals. The
development user's own past visit at Gentlemen's Den is left unreviewed so the
review flow can be tried immediately. Seeding runs only when the shops table is
empty.

## Security notes

Every `/api/*` route requires a signed-in user and scopes reads and writes by
`owner_sub` or `customer_sub`. Shop mutations resolve the shop from the signed-in
owner; admin routes require `is_admin` or `ADMIN_EMAILS`. Mutations must be
same-origin (`isSameOriginRequest`), and personalised responses are
`Cache-Control: private, no-store`.

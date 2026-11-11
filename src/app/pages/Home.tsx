import { ArrowRight, MapPin, Scissors, Search, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { ShopCard } from '../components/shop'
import { EmptyState, Skeleton } from '../components/ui'
import { useMe, useShops } from '../lib/api'
import { cx } from '../lib/cx'

const sortOptions = [
  { key: 'rating', label: 'Top rated' },
  { key: 'price', label: 'Lowest price' },
  { key: 'new', label: 'Newest' },
] as const

export function Home() {
  const { data: me } = useMe()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [city, setCity] = useState('')
  const [sort, setSort] = useState<'rating' | 'price' | 'new'>('rating')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const { data, isLoading } = useShops({ q: debounced, city, sort })
  const shops = data?.items ?? []
  const total = data?.cities.reduce((sum, entry) => sum + entry.count, 0) ?? 0

  return (
    <div className="mx-auto max-w-[1180px] p-5 sm:p-8">
      <section className="relative overflow-hidden rounded-card bg-[#173d33] px-6 py-8 text-[#f6f2e8] sm:px-10 sm:py-11">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: 'repeating-linear-gradient(120deg, rgba(255,255,255,0.9) 0 1px, transparent 1px 18px)' }}
        />
        <div className="absolute -right-10 -top-16 size-64 rounded-full bg-[#c9a561]/20 blur-2xl" />
        <div className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-[#1f6d59]/40 blur-3xl" />

        <div className="relative">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#d9c193]">
            <Scissors className="size-3.5 -rotate-45" />
            Asli ustaad, asli waqt · {total > 0 ? `${total} shops` : '12 cities'}
          </p>
          <h1 className="mt-3 max-w-[620px] text-balance text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[38px]">
            Book a proper cut, without the wait.
          </h1>
          <p className="mt-2.5 max-w-[520px] text-[14px] leading-relaxed text-[#dfe6e1]/85">
            Real chairs, real prices in rupees. See who is free right now and lock your slot in a few taps — no calling, no guessing.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <div className="flex h-11 flex-1 items-center gap-2 rounded-control bg-[#fdfcf8] px-3.5 text-fg shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
              <Search className="size-4 shrink-0 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search shop, area or city — “Gulberg”"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
                aria-label="Search barbershops"
              />
            </div>
            <div className="flex h-11 items-center gap-1 rounded-control bg-white/10 p-1">
              {sortOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSort(option.key)}
                  className={cx(
                    'h-full rounded-[9px] px-3 text-[12.5px] font-medium transition-colors',
                    sort === option.key ? 'bg-[#fdfcf8] text-[#173d33]' : 'text-[#e7e2d5] hover:bg-white/10',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCity('')}
          className={cx(
            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
            city === '' ? 'border-fg bg-fg text-white' : 'border-line-strong bg-surface text-muted hover:text-fg',
          )}
        >
          <MapPin className="size-3.5" /> All cities
        </button>
        {(data?.cities ?? []).map((entry) => (
          <button
            key={entry.city}
            type="button"
            onClick={() => setCity(entry.city === city ? '' : entry.city)}
            className={cx(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
              city === entry.city ? 'border-fg bg-fg text-white' : 'border-line-strong bg-surface text-muted hover:text-fg',
            )}
          >
            {entry.city}
            <span className={cx('text-[11px]', city === entry.city ? 'text-white/60' : 'text-faint')}>{entry.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-7 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">
            {city ? `Barbershops in ${city}` : 'Barbershops across Pakistan'}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {debounced ? `Results for “${debounced}”` : 'Approved shops with live availability'}
            {!isLoading && ` · ${shops.length} shown`}
          </p>
        </div>
        <Link to="/bookings" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12.5px] font-medium text-muted hover:text-fg">
          My bookings <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-[270px] rounded-card" />)
          : shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
      </div>

      {!isLoading && shops.length === 0 && (
        <EmptyState
          icon={<Search />}
          title="No shops match that"
          description="Try another area or clear the search. New shops are added across Pakistan every week."
        />
      )}

      <section className="mt-8 grid gap-3 rounded-card border border-line bg-surface p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[#f0ece1] text-[#173d33]">
            <Store className="size-5" />
          </span>
          <div>
            <h3 className="text-[14.5px] font-semibold">
              {me?.shop ? `You run ${me.shop.name}` : 'Do you run a barbershop?'}
            </h3>
            <p className="mt-0.5 max-w-lg text-[13px] leading-relaxed text-muted">
              {me?.shop
                ? 'Manage your appointments, prices and team from one dashboard.'
                : 'List your shop, set your own rupee prices and take bookings from customers across Pakistan. Approval is quick.'}
            </p>
          </div>
        </div>
        <Link
          to="/shop"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-control bg-fg px-4 text-[13px] font-medium text-white hover:bg-[#26262c]"
        >
          {me?.shop ? 'Open dashboard' : 'List your shop'} <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  )
}

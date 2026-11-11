// Barber-shop photography bundled with the app (Unsplash License, free for
// commercial use, no attribution required). Each shop gets a stable photo from
// its id, so a shop looks the same on every device without storing a URL.
const SHOP_PHOTOS = [
  '/img/shops/shop-1.jpg',
  '/img/shops/shop-2.jpg',
  '/img/shops/shop-3.jpg',
  '/img/shops/shop-4.jpg',
  '/img/shops/shop-5.jpg',
  '/img/shops/shop-6.jpg',
  '/img/shops/shop-7.jpg',
  '/img/shops/shop-8.jpg',
  '/img/shops/shop-9.jpg',
]

export function shopPhoto(key: string): string {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 100_000
  return SHOP_PHOTOS[hash % SHOP_PHOTOS.length]
}

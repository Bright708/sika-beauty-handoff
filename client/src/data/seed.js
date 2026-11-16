// Development seed data, in exactly the shape the API returns (phase 3).
// The same products are seeded into Supabase by the migration, so swapping
// the data source does not change any component.

export const categories = [
  { id: 1, name: 'Perfume', slug: 'perfume', sort: 1 },
  { id: 2, name: 'Body cream', slug: 'body-cream', sort: 2 },
  { id: 3, name: 'Body butter', slug: 'body-butter', sort: 3 },
  { id: 4, name: 'Body oil', slug: 'body-oil', sort: 4 },
  { id: 5, name: 'Body mist', slug: 'body-mist', sort: 5 },
  { id: 6, name: 'Gift set', slug: 'gift-set', sort: 6 },
]

const cat = (slug) => {
  const c = categories.find((x) => x.slug === slug)
  return { id: c.id, name: c.name, slug: c.slug }
}

let vid = 100
const v = (size_label, price_ghs, stock, sale_price_ghs = null) => ({
  id: `v${++vid}`,
  size_label,
  price_ghs,
  sale_price_ghs,
  stock,
})

const day = (n) => new Date(Date.UTC(2026, 10, 15 - n)).toISOString()

export const products = [
  {
    id: 'p1',
    slug: 'oud-noir',
    name: 'Oud Noir',
    brand: null,
    category: cat('perfume'),
    description: 'Smoky oud and saffron over warm amber. Strong, close and made for evenings out.',
    notes_top: 'bergamot, saffron',
    notes_heart: 'rose, oud',
    notes_base: 'amber, vanilla, musk',
    status: 'live',
    created_at: day(1),
    variants: [v('50ml', 520, 8), v('100ml', 1050, 2, 850)],
    images: [],
  },
  {
    id: 'p2',
    slug: 'shea-and-vanilla',
    name: 'Shea and Vanilla',
    brand: null,
    category: cat('body-butter'),
    description: 'Whipped shea butter with soft vanilla. Melts in and keeps skin soft all day.',
    status: 'live',
    created_at: day(2),
    variants: [v('250ml', 180, 14)],
    images: [],
  },
  {
    id: 'p3',
    slug: 'velvet-rose',
    name: 'Velvet Rose',
    brand: null,
    category: cat('perfume'),
    description: 'Fresh red rose with a creamy musk base. Easy to wear from morning to night.',
    notes_top: 'pink pepper, lychee',
    notes_heart: 'rose, peony',
    notes_base: 'white musk, cedar',
    status: 'live',
    created_at: day(3),
    variants: [v('50ml', 620, 6)],
    images: [],
  },
  {
    id: 'p4',
    slug: 'cocoa-glow',
    name: 'Cocoa Glow',
    brand: null,
    category: cat('body-oil'),
    description: 'Light cocoa body oil with a soft golden sheen. Absorbs fast, no sticky feel.',
    status: 'live',
    created_at: day(4),
    variants: [v('100ml', 260, 9, 220)],
    images: [],
  },
  {
    id: 'p5',
    slug: 'amber-musk',
    name: 'Amber Musk',
    brand: null,
    category: cat('body-mist'),
    description: 'Warm amber and clean musk in a light mist. Spray on after your shower.',
    status: 'live',
    created_at: day(5),
    variants: [v('200ml', 150, 20)],
    images: [],
  },
  {
    id: 'p6',
    slug: 'night-jasmine',
    name: 'Night Jasmine',
    brand: null,
    category: cat('perfume'),
    description: 'Night-blooming jasmine and tuberose over sandalwood. Rich and long-lasting.',
    notes_top: 'mandarin, neroli',
    notes_heart: 'jasmine, tuberose',
    notes_base: 'sandalwood, vanilla',
    status: 'live',
    created_at: day(6),
    variants: [v('100ml', 700, 0)],
    images: [],
  },
  {
    id: 'p7',
    slug: 'coconut-milk',
    name: 'Coconut Milk',
    brand: null,
    category: cat('body-cream'),
    description: 'Everyday body lotion with coconut milk and shea. Light enough for Accra heat.',
    status: 'live',
    created_at: day(7),
    variants: [v('400ml', 140, 25)],
    images: [],
  },
  {
    id: 'p8',
    slug: 'citrus-bloom',
    name: 'Citrus Bloom',
    brand: null,
    category: cat('perfume'),
    description: 'Bright orange blossom and grapefruit. A fresh daytime scent that lifts the mood.',
    notes_top: 'grapefruit, bergamot',
    notes_heart: 'orange blossom, neroli',
    notes_base: 'musk, vetiver',
    status: 'live',
    created_at: day(8),
    variants: [v('50ml', 560, 5, 480)],
    images: [],
  },
]

// Until there are real orders, "Best sellers" uses this order.
// From phase 3 the API ranks by quantity sold in paid orders.
export const bestSellerSlugs = ['oud-noir', 'shea-and-vanilla', 'night-jasmine', 'cocoa-glow']

export const settings = {
  shop_name: 'Sika Beauty',
  whatsapp: '233240000000',
  pickup_address: '[Pickup address], Accra',
  pickup_hours: 'Mon to Sat, 10am to 6pm',
  cutoff_time: '[CUT-OFF TIME]',
  free_delivery_threshold_ghs: null,
  delivery_zones: [
    { id: 1, name: 'Accra Central', fee_ghs: 30, sort: 1 },
    { id: 2, name: 'East Legon, Airport, Cantonments', fee_ghs: 40, sort: 2 },
    { id: 3, name: 'Spintex, Tema', fee_ghs: 50, sort: 3 },
    { id: 4, name: 'Kasoa, Madina, Adenta', fee_ghs: 60, sort: 4 },
  ],
}

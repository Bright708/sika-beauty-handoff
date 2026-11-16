// In-browser stand-in for the Express API, used until VITE_API_URL is set (phase 3).
// Same query parameters and response shape as the real endpoints.
import { products, categories, settings, bestSellerSlugs } from './seed'
import { defaultVariant, effectivePrice, inStock, productOnSale } from '../lib/catalog'

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms))
const clone = (x) => structuredClone(x)

export async function getProducts({
  category, // comma-separated category slugs
  on_sale,
  in_stock,
  sort = 'newest', // newest | price_asc | price_desc | best
  page = 1,
  limit = 12,
  exclude,
} = {}) {
  await delay()
  let list = products.filter((p) => p.status === 'live')
  if (category) {
    const slugs = String(category).split(',')
    list = list.filter((p) => slugs.includes(p.category.slug))
  }
  if (on_sale) list = list.filter(productOnSale)
  if (in_stock) list = list.filter(inStock)
  if (exclude) list = list.filter((p) => p.slug !== exclude)

  const price = (p) => effectivePrice(defaultVariant(p))
  if (sort === 'price_asc') list.sort((a, b) => price(a) - price(b))
  else if (sort === 'price_desc') list.sort((a, b) => price(b) - price(a))
  else if (sort === 'best') {
    const rank = (p) => {
      const i = bestSellerSlugs.indexOf(p.slug)
      return i === -1 ? 999 : i
    }
    list.sort((a, b) => rank(a) - rank(b))
  } else list.sort((a, b) => b.created_at.localeCompare(a.created_at))

  const total = list.length
  const start = (page - 1) * limit
  return {
    products: clone(list.slice(start, start + limit)),
    total,
    page,
    has_more: start + limit < total,
  }
}

export async function getProduct(slug) {
  await delay()
  const p = products.find((x) => x.slug === slug && x.status === 'live')
  if (!p) {
    const err = new Error('not_found')
    err.status = 404
    throw err
  }
  return clone(p)
}

export async function getCategories() {
  await delay(0)
  return clone(categories)
}

export async function getSettings() {
  await delay(0)
  return clone(settings)
}

// Bag drawer details for variant ids (live products only)
export async function getVariants(ids) {
  await delay(0)
  const wanted = new Set(ids)
  return products
    .filter((p) => p.status === 'live')
    .flatMap((p) =>
      p.variants
        .filter((v) => wanted.has(v.id))
        .map((v) => ({
          ...clone(v),
          product: { id: p.id, name: p.name, slug: p.slug, image: p.images?.[0] || null },
        })),
    )
}

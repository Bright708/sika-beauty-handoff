import { Router } from 'express'
import { db } from '../lib/supabase.js'
import { check, intParam, notFound } from '../lib/http.js'
import {
  PUBLIC_PRODUCT_SELECT,
  defaultVariant,
  effectivePrice,
  inStock,
  productOnSale,
  shapeProduct,
} from '../lib/catalog.js'

const router = Router()
const SORTS = new Set(['newest', 'price_asc', 'price_desc', 'best'])
const truthy = (v) => v === '1' || v === 'true'

// GET /api/products?category=perfume,body-oil&on_sale=1&in_stock=1&sort=newest&page=1&limit=12&exclude=slug
//
// A small shop has at most a few hundred products, so we load all live products in one
// query and filter/sort in memory. That keeps "price" sorting correct (it depends on the
// sale price of the displayed size) without extra database views.
router.get('/', async (req, res) => {
  const sort = SORTS.has(req.query.sort) ? req.query.sort : 'newest'
  const page = intParam(req.query.page, { min: 1, max: 1000, fallback: 1 })
  const limit = intParam(req.query.limit, { min: 1, max: 48, fallback: 12 })
  const slugs = req.query.category ? String(req.query.category).split(',').filter(Boolean).slice(0, 10) : null

  let query = db.from('products').select(PUBLIC_PRODUCT_SELECT).eq('status', 'live')
  if (req.query.exclude) query = query.neq('slug', String(req.query.exclude))
  let list = check(await query, 'products.list').map(shapeProduct)

  // Hide products that have no sizes yet (they cannot be bought)
  list = list.filter((p) => p.variants.length > 0)
  if (slugs) list = list.filter((p) => slugs.includes(p.category?.slug))
  if (truthy(req.query.on_sale)) list = list.filter(productOnSale)
  if (truthy(req.query.in_stock)) list = list.filter(inStock)

  const price = (p) => effectivePrice(defaultVariant(p))
  const newest = (a, b) => b.created_at.localeCompare(a.created_at)

  if (sort === 'price_asc') list.sort((a, b) => price(a) - price(b) || newest(a, b))
  else if (sort === 'price_desc') list.sort((a, b) => price(b) - price(a) || newest(a, b))
  else if (sort === 'best') {
    // Rank by quantity sold in paid orders; products with no sales follow, newest first.
    const ranked = check(await db.rpc('best_seller_ids', { max_count: 200 }), 'products.best') || []
    const rank = new Map(ranked.map((r, i) => [r.product_id, i]))
    list.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9) || newest(a, b))
  } else list.sort(newest)

  const total = list.length
  const start = (page - 1) * limit
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
  res.json({
    products: list.slice(start, start + limit),
    total,
    page,
    has_more: start + limit < total,
  })
})

// GET /api/products/:slug
router.get('/:slug', async (req, res) => {
  const data = check(
    await db
      .from('products')
      .select(PUBLIC_PRODUCT_SELECT)
      .eq('slug', req.params.slug)
      .eq('status', 'live')
      .maybeSingle(),
    'products.get',
  )
  if (!data) throw notFound('This product is no longer available.')
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
  res.json(shapeProduct(data))
})

export default router

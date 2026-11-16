import { Router } from 'express'
import { db } from '../lib/supabase.js'
import { check, notFound, badRequest, HttpError } from '../lib/http.js'
import { requireAdmin } from '../lib/auth.js'
import { insertProduct } from '../lib/products.js'
import { createUploadUrl, processUpload, removeStored, STORED_PATH } from '../lib/images.js'

// Everything under /api/admin requires a signed-in admin (see lib/auth.js).
const router = Router()
router.use(requireAdmin)
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

const ADMIN_PRODUCT_SELECT = `
  id, slug, name, brand, description, notes_top, notes_heart, notes_base, status, created_at, updated_at,
  category_id,
  category:categories ( id, name, slug ),
  variants:product_variants ( id, size_label, price_ghs, sale_price_ghs, stock, sku, sort ),
  images:product_images ( id, storage_path, sort )
`
const MAX_IMAGES = 6
const MAX_VARIANTS = 12

const shape = (p) => ({
  ...p,
  variants: [...(p.variants || [])].sort((a, b) => a.sort - b.sort),
  images: [...(p.images || [])].sort((a, b) => a.sort - b.sort),
})

// ---------- validation (friendly, per field) ----------

const text = (v, max) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s.slice(0, max) : null
}

// Whole cedis. Accepts "1,050" or "1050". Returns NaN for anything else.
function money(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN
  const s = String(v ?? '').replace(/[,\s]/g, '').replace(/^gh₵|^ghs/i, '')
  if (!s) return null
  return /^\d+$/.test(s) ? Number(s) : NaN
}

function parseProduct(body, categoryIds) {
  const errors = {}
  const name = text(body.name, 120)
  if (!name) errors.name = 'Please give the product a name.'

  const category_id = Number(body.category_id)
  if (!categoryIds.has(category_id)) errors.category_id = 'Please choose a category.'

  const status = body.status === 'live' ? 'live' : 'draft'

  const rows = Array.isArray(body.variants) ? body.variants : []
  if (!rows.length) errors.variants = 'Add at least one size with a price.'
  if (rows.length > MAX_VARIANTS) errors.variants = `You can add up to ${MAX_VARIANTS} sizes.`
  const seen = new Set()
  const variants = rows.slice(0, MAX_VARIANTS).map((r, i) => {
    const size_label = text(r.size_label, 40)
    const price = money(r.price_ghs)
    const sale = money(r.sale_price_ghs)
    const stockRaw = String(r.stock ?? '').trim()
    const stock = stockRaw === '' ? 0 : /^\d+$/.test(stockRaw) ? Number(stockRaw) : NaN
    const at = (k, msg) => (errors[`variants.${i}.${k}`] = msg)

    if (!size_label) at('size_label', 'Add a size, e.g. 50ml.')
    else if (seen.has(size_label.toLowerCase())) at('size_label', 'This size is listed twice.')
    else seen.add(size_label.toLowerCase())

    if (price === null) at('price_ghs', 'Add a price.')
    else if (Number.isNaN(price) || price <= 0) at('price_ghs', 'Use whole cedis, e.g. 520.')
    else if (price > 1_000_000) at('price_ghs', 'That price looks too high.')

    if (sale !== null) {
      if (Number.isNaN(sale) || sale <= 0) at('sale_price_ghs', 'Use whole cedis, or leave it empty.')
      else if (!Number.isNaN(price) && price !== null && sale >= price)
        at('sale_price_ghs', 'The sale price must be lower than the price.')
    }
    if (Number.isNaN(stock)) at('stock', 'Use a whole number, e.g. 10.')
    else if (stock > 100_000) at('stock', 'That stock number looks too high.')

    return {
      id: typeof r.id === 'string' && /^[0-9a-f-]{36}$/.test(r.id) ? r.id : null,
      size_label,
      price_ghs: price,
      sale_price_ghs: sale,
      stock,
      sort: i,
    }
  })

  const images = Array.isArray(body.images) ? body.images : []
  if (images.length > MAX_IMAGES) errors.images = `You can add up to ${MAX_IMAGES} photos.`
  if (images.some((p) => !STORED_PATH.test(p))) errors.images = 'One of the photos did not upload properly. Remove it and add it again.'

  if (Object.keys(errors).length) {
    throw badRequest('Please fix the highlighted fields.', { errors })
  }

  const isPerfume = body.category_slug === 'perfume'
  return {
    product: {
      name,
      category_id,
      brand: text(body.brand, 80),
      description: text(body.description, 2000),
      notes_top: isPerfume ? text(body.notes_top, 200) : null,
      notes_heart: isPerfume ? text(body.notes_heart, 200) : null,
      notes_base: isPerfume ? text(body.notes_base, 200) : null,
      status,
    },
    variants,
    images: [...new Set(images)].slice(0, MAX_IMAGES),
  }
}

async function loadCategories() {
  const cats = check(await db.from('categories').select('id, slug'), 'categories')
  return { ids: new Set(cats.map((c) => c.id)), slugById: new Map(cats.map((c) => [c.id, c.slug])) }
}

async function getProduct(id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw notFound('We could not find that product.')
  const p = check(await db.from('products').select(ADMIN_PRODUCT_SELECT).eq('id', id).maybeSingle(), 'product')
  if (!p) throw notFound('We could not find that product. It may have been deleted.')
  return shape(p)
}

function withCategorySlug(body, slugById) {
  return { ...body, category_slug: slugById.get(Number(body.category_id)) }
}

// ---------- routes ----------

router.get('/me', (req, res) => res.json(req.admin))

// All products, live and draft. The catalogue is small, so the admin filters and searches in the browser.
router.get('/products', async (_req, res) => {
  const rows = check(
    await db.from('products').select(ADMIN_PRODUCT_SELECT).order('created_at', { ascending: false }),
    'admin products',
  )
  res.json(rows.map(shape))
})

router.get('/products/:id', async (req, res) => res.json(await getProduct(req.params.id)))

router.post('/products', async (req, res) => {
  const { ids, slugById } = await loadCategories()
  const { product, variants, images } = parseProduct(withCategorySlug(req.body || {}, slugById), ids)

  const id = await insertProduct({ product, variants, images })
  res.status(201).json(await getProduct(id))
})

router.put('/products/:id', async (req, res) => {
  const current = await getProduct(req.params.id)
  const { ids, slugById } = await loadCategories()
  const { product, variants, images } = parseProduct(withCategorySlug(req.body || {}, slugById), ids)

  // The slug stays the same on edit so shared links keep working.
  check(await db.from('products').update(product).eq('id', current.id), 'update product')

  // Sizes: update the ones we know, add new ones, delete the ones removed.
  const known = new Set(current.variants.map((v) => v.id))
  const keep = new Set(variants.filter((v) => v.id && known.has(v.id)).map((v) => v.id))
  const removed = [...known].filter((id) => !keep.has(id))
  if (removed.length) check(await db.from('product_variants').delete().in('id', removed), 'remove variants')
  for (const v of variants) {
    const { id, ...fields } = v
    if (id && known.has(id)) {
      check(await db.from('product_variants').update(fields).eq('id', id), 'update variant')
    } else {
      check(await db.from('product_variants').insert({ ...fields, product_id: current.id }), 'add variant')
    }
  }

  // Photos: replace the list (order = sort, first = cover), then delete files no longer used.
  check(await db.from('product_images').delete().eq('product_id', current.id), 'clear images')
  if (images.length) {
    check(
      await db
        .from('product_images')
        .insert(images.map((storage_path, sort) => ({ product_id: current.id, storage_path, sort }))),
      'save images',
    )
  }
  const dropped = current.images.map((i) => i.storage_path).filter((p) => !images.includes(p))
  await removeStored(dropped)

  res.json(await getProduct(current.id))
})

router.delete('/products/:id', async (req, res) => {
  const current = await getProduct(req.params.id)
  check(await db.from('products').delete().eq('id', current.id), 'delete product')
  await removeStored(current.images.map((i) => i.storage_path))
  res.json({ ok: true })
})

// Bulk: { ids: [...], action: 'show' | 'hide' | 'delete' }
router.post('/products/bulk', async (req, res) => {
  const { action } = req.body || {}
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((id) => /^[0-9a-f-]{36}$/.test(id)).slice(0, 500)
  if (!ids.length) throw badRequest('Select at least one product first.')

  if (action === 'show' || action === 'hide') {
    const status = action === 'show' ? 'live' : 'draft'
    check(await db.from('products').update({ status }).in('id', ids), 'bulk status')
  } else if (action === 'delete') {
    const imgs = check(await db.from('product_images').select('storage_path').in('product_id', ids), 'bulk images')
    check(await db.from('products').delete().in('id', ids), 'bulk delete')
    await removeStored(imgs.map((i) => i.storage_path))
  } else {
    throw badRequest('Choose Show, Hide or Delete.')
  }
  res.json({ ok: true, count: ids.length })
})

// Photo uploads: 1) get a signed URL, 2) upload to it from the browser, 3) process.
router.post('/uploads', async (req, res) => {
  res.json(await createUploadUrl(req.body?.content_type))
})

router.post('/uploads/process', async (req, res) => {
  res.json(await processUpload(req.body?.path))
})

router.use((_req, _res, next) => next(new HttpError(404, 'We could not find that.')))

export default router

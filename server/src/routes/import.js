import express, { Router } from 'express'
import * as XLSX from 'xlsx'
import { db } from '../lib/supabase.js'
import { check, badRequest } from '../lib/http.js'
import { requireAdmin } from '../lib/auth.js'
import { insertProduct } from '../lib/products.js'
import { importImageFromUrl, removeStored } from '../lib/images.js'

// Spreadsheet import (admin only).
//   GET  /api/admin/import/template  -> .xlsx with the right columns and 2 example rows
//   POST /api/admin/import/preview   -> body is the .xlsx/.csv file; checks every row, writes nothing
//   POST /api/admin/import/commit    -> { rows, publish }; checks again, then creates the products
// One row per size. Rows with the same product name become one product with several sizes.
//
// Mounted BEFORE the global express.json so it can take bigger bodies (only after sign-in).

const router = Router()
router.use(requireAdmin)
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

const MAX_ROWS = 1000
const MAX_SIZES = 12
const MAX_PHOTOS = 6
const COLUMNS = [
  'name', 'category', 'brand', 'size', 'price', 'sale_price', 'stock',
  'description', 'notes_top', 'notes_heart', 'notes_base', 'photo_url',
]
const REQUIRED = ['name', 'category', 'size', 'price', 'stock']

// Friendly header names people might type instead of ours
const ALIASES = {
  product: 'name', product_name: 'name', title: 'name',
  type: 'category',
  size_label: 'size', volume: 'size',
  price_ghs: 'price', regular_price: 'price',
  sale: 'sale_price', sale_price_ghs: 'sale_price', discount_price: 'sale_price',
  quantity: 'stock', qty: 'stock', in_stock: 'stock',
  top_notes: 'notes_top', heart_notes: 'notes_heart', middle_notes: 'notes_heart', base_notes: 'notes_base',
  photo: 'photo_url', photo_link: 'photo_url', image: 'photo_url', image_url: 'photo_url', photo_links: 'photo_url',
}
const headerKey = (h) => {
  const k = String(h ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // "Price (GH₵)" -> "price"
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return ALIASES[k] || k
}

// ---------- reading the file ----------

function readSheet(buf) {
  if (!buf?.length) throw badRequest('That file is empty.')
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b // .xlsx
  const isOle = buf[0] === 0xd0 && buf[1] === 0xcf // old .xls
  let wb
  try {
    wb =
      isZip || isOle
        ? XLSX.read(buf, { type: 'buffer', cellFormula: false, cellHTML: false })
        : XLSX.read(buf.toString('utf8').replace(/^﻿/, ''), { type: 'string', raw: true })
  } catch {
    throw badRequest('We could not read that file. Save it as .xlsx or .csv and try again.')
  }
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw badRequest('That file has no sheets.')
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false })
  if (!grid.length) throw badRequest('That file is empty.')

  const headers = grid[0].map(headerKey)
  const missing = REQUIRED.filter((c) => !headers.includes(c))
  if (missing.length) {
    throw badRequest(
      `We could not find these columns: ${missing.join(', ')}. Download the template to see the layout.`,
    )
  }
  const rows = []
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i]
    if (cells.every((c) => String(c).trim() === '')) continue
    const row = { row: i + 1 } // spreadsheet row number (header is row 1)
    headers.forEach((h, j) => {
      if (COLUMNS.includes(h) && row[h] === undefined) row[h] = cells[j] ?? ''
    })
    rows.push(row)
  }
  if (!rows.length) throw badRequest('There are no products in that file yet. Fill in a row under the headings.')
  if (rows.length > MAX_ROWS) throw badRequest(`That file has ${rows.length} rows. Please import up to ${MAX_ROWS} at a time.`)
  return rows
}

// ---------- checking rows ----------

const str = (v, max) => String(v ?? '').trim().slice(0, max)

// Whole cedis. Accepts 1050, "1,050", "GH₵ 1,050". null = empty, NaN = not a whole number.
function money(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN
  const s = String(v ?? '').replace(/gh₵|ghs|ghc|cedis?|[,\s]/gi, '')
  if (!s) return null
  return /^\d+$/.test(s) ? Number(s) : /^\d+\.0+$/.test(s) ? Number.parseInt(s, 10) : NaN
}
function count(v) {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? v : NaN
  const s = String(v ?? '').replace(/[,\s]/g, '')
  if (!s) return null
  return /^\d+$/.test(s) ? Number(s) : NaN
}
const photoLinks = (v) =>
  String(v ?? '')
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)

function categoryMatcher(categories) {
  const map = new Map()
  for (const c of categories) {
    for (const key of [c.name, c.slug, `${c.name}s`, c.slug.replace(/-/g, ' ')]) map.set(key.toLowerCase(), c)
  }
  return (v) => map.get(String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' '))
}

// Returns rows with status + plain-words errors, and the products that would be created.
function checkRows(rawRows, categories, existingNames) {
  const findCategory = categoryMatcher(categories)
  const categoryList = categories.map((c) => c.name).join(', ')
  const groups = new Map() // lower-case name -> { name, rows: [] }

  const rows = rawRows.map((raw) => {
    const errors = []
    const warnings = []
    const name = str(raw.name, 120)
    const size = str(raw.size, 40)
    const price = money(raw.price)
    const sale = money(raw.sale_price)
    const stock = count(raw.stock)
    const category = findCategory(raw.category)
    const links = photoLinks(raw.photo_url)

    if (!name) errors.push('Name is missing')
    if (!str(raw.category, 60)) errors.push(`Category is missing. Use one of: ${categoryList}`)
    else if (!category) errors.push(`Category must be one of: ${categoryList}`)
    if (!size) errors.push('Size is missing (for example 50ml, or One size)')
    if (price === null) errors.push('Price is missing')
    else if (Number.isNaN(price) || price <= 0) errors.push('Price must be a whole number of cedis, like 520')
    if (sale !== null) {
      if (Number.isNaN(sale) || sale <= 0) errors.push('Sale price must be a whole number of cedis, or left empty')
      else if (price && !Number.isNaN(price) && sale >= price) errors.push('Sale price must be lower than the price')
    }
    if (stock === null) errors.push('Stock is missing (use 0 if it is sold out)')
    else if (Number.isNaN(stock)) errors.push('Stock must be a whole number, like 10')
    const badLink = links.find((l) => !/^https?:\/\/\S+\.\S+/i.test(l))
    if (badLink) errors.push('Photo link must start with http:// or https://')

    const row = {
      row: raw.row,
      name,
      category: category?.name || str(raw.category, 60),
      size,
      price: Number.isNaN(price) ? null : price,
      sale_price: Number.isNaN(sale) ? null : sale,
      stock: Number.isNaN(stock) ? null : stock,
      photos: links.length,
      errors,
      warnings,
      _category: category,
      _links: links,
      _raw: raw,
    }
    if (name) {
      const key = name.toLowerCase()
      if (!groups.has(key)) groups.set(key, { name, rows: [] })
      groups.get(key).rows.push(row)
    }
    return row
  })

  // Rules across rows of the same product
  for (const g of groups.values()) {
    const first = g.rows.find((r) => r._category)
    const sizes = new Map()
    let ok = 0
    for (const r of g.rows) {
      if (existingNames.has(g.name.toLowerCase())) {
        r.errors.push(`${g.name} is already in your shop. Use a different name, or edit it in Products`)
      }
      if (first && r._category && r._category.id !== first._category.id) {
        r.errors.push(`Same name as row ${first.row} but a different category`)
      }
      const sk = r.size.toLowerCase()
      if (r.size && sizes.has(sk)) r.errors.push(`Size ${r.size} is already on row ${sizes.get(sk)} for ${g.name}`)
      else if (r.size) sizes.set(sk, r.row)
      if (!r.errors.length && ++ok > MAX_SIZES) r.errors.push(`A product can have up to ${MAX_SIZES} sizes`)
    }
    const links = [...new Set(g.rows.filter((r) => !r.errors.length).flatMap((r) => r._links))]
    if (links.length > MAX_PHOTOS) {
      g.rows.find((r) => r._links.length)?.warnings.push(`Only the first ${MAX_PHOTOS} photos will be used`)
    }
  }

  for (const r of rows) r.status = r.errors.length ? 'error' : 'ready'

  // The products to create: each name with at least one ready row
  const products = []
  for (const g of groups.values()) {
    const ready = g.rows.filter((r) => r.status === 'ready')
    if (!ready.length) continue
    const pick = (k) => ready.map((r) => str(r._raw[k], k === 'description' ? 2000 : 200)).find(Boolean) || null
    const category = ready[0]._category
    const isPerfume = category.slug === 'perfume'
    products.push({
      name: ready[0].name,
      rows: ready.map((r) => r.row),
      product: {
        name: ready[0].name,
        category_id: category.id,
        brand: pick('brand')?.slice(0, 80) || null,
        description: pick('description'),
        notes_top: isPerfume ? pick('notes_top') : null,
        notes_heart: isPerfume ? pick('notes_heart') : null,
        notes_base: isPerfume ? pick('notes_base') : null,
      },
      variants: ready.map((r) => ({
        size_label: r.size,
        price_ghs: r.price,
        sale_price_ghs: r.sale_price,
        stock: r.stock,
      })),
      // each photo link with the row it came from, first 6 unique links only
      links: [...new Map(ready.flatMap((r) => r._links.map((url) => [url, { url, row: r.row }]))).values()].slice(0, MAX_PHOTOS),
    })
  }

  const publicRows = rows.map(({ _category, _links, _raw, ...r }) => ({ ...r, data: _raw }))
  return {
    rows: publicRows,
    products,
    summary: {
      products_ready: products.length,
      rows_ready: rows.filter((r) => r.status === 'ready').length,
      rows_with_errors: rows.filter((r) => r.status === 'error').length,
      photos: products.reduce((n, p) => n + p.links.length, 0),
    },
  }
}

async function context() {
  const [cats, names] = await Promise.all([
    db.from('categories').select('id, name, slug').order('sort'),
    db.from('products').select('name'),
  ])
  return {
    categories: check(cats, 'categories'),
    existingNames: new Set(check(names, 'product names').map((p) => p.name.trim().toLowerCase())),
  }
}

// ---------- routes ----------

router.get('/template', async (_req, res) => {
  const { categories } = await context()
  const wb = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    COLUMNS,
    ['Rose Oud (example)', 'Perfume', 'Lattafa', '50ml', 520, '', 8,
      'Soft rose over warm oud. Lasts all evening.', 'bergamot, saffron', 'rose, oud', 'amber, vanilla, musk', ''],
    ['Rose Oud (example)', 'Perfume', 'Lattafa', '100ml', 1050, 850, 3, '', '', '', '', ''],
  ])
  sheet['!cols'] = [24, 14, 14, 10, 10, 11, 8, 44, 20, 20, 20, 40].map((wch) => ({ wch }))
  XLSX.utils.book_append_sheet(wb, sheet, 'Products')

  const help = XLSX.utils.aoa_to_sheet([
    ['How to fill in the Products sheet'],
    [],
    ['One row per size. Two sizes of the same perfume = two rows with exactly the same name.'],
    ['Replace the two example rows with your own products before uploading.'],
    ['Nothing goes live until you check it and choose "Import" on the next screen.'],
    [],
    ['Column', 'Needed?', 'What to write'],
    ['name', 'Yes', 'The product name, e.g. Oud Noir'],
    ['category', 'Yes', `One of: ${categories.map((c) => c.name).join(', ')}`],
    ['brand', 'No', 'e.g. Lattafa'],
    ['size', 'Yes', 'e.g. 50ml, 250g or One size'],
    ['price', 'Yes', 'Whole cedis, numbers only, e.g. 520'],
    ['sale_price', 'No', 'Lower than the price. Leave empty if not on sale'],
    ['stock', 'Yes', 'How many you have. 0 if sold out'],
    ['description', 'No', 'What it smells or feels like. Only needed on the first row of a product'],
    ['notes_top, notes_heart, notes_base', 'No', 'Perfumes only. Separate notes with commas'],
    ['photo_url', 'No', 'A link to a photo. Google Drive links must be shared with "Anyone with the link". Several links can go in one cell, separated by spaces'],
  ])
  help['!cols'] = [{ wch: 34 }, { wch: 10 }, { wch: 90 }]
  XLSX.utils.book_append_sheet(wb, help, 'How to fill it in')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="sika-products-template.xlsx"',
  })
  res.send(buf)
})

router.post('/preview', express.raw({ type: () => true, limit: '5mb' }), async (req, res) => {
  const rawRows = readSheet(req.body)
  const ctx = await context()
  const { rows, summary } = checkRows(rawRows, ctx.categories, ctx.existingNames)
  res.json({ rows, summary })
})

router.post('/commit', express.json({ limit: '5mb' }), async (req, res) => {
  const input = Array.isArray(req.body?.rows) ? req.body.rows : null
  if (!input?.length) throw badRequest('There is nothing to import. Upload your file again.')
  if (input.length > MAX_ROWS) throw badRequest(`Please import up to ${MAX_ROWS} rows at a time.`)
  const status = req.body.publish === true ? 'live' : 'draft'

  // Never trust what comes back from the browser: check everything again.
  const rawRows = input.map((r, i) => {
    const data = r && typeof r.data === 'object' && r.data ? r.data : {}
    const row = { row: Number.isInteger(r?.row) ? r.row : i + 2 }
    for (const c of COLUMNS) row[c] = typeof data[c] === 'number' || typeof data[c] === 'string' ? data[c] : ''
    return row
  })
  const ctx = await context()
  const { products, summary } = checkRows(rawRows, ctx.categories, ctx.existingNames)

  const created = []
  const failed = []
  const warnings = []
  // A few products at a time keeps photo downloads quick without overloading a small server.
  const queue = [...products]
  async function worker() {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const images = []
      for (const link of p.links) {
        try {
          images.push(await importImageFromUrl(link.url))
        } catch (err) {
          warnings.push(`Row ${link.row}, ${p.name}: ${err.message}. The product was added without that photo.`)
        }
      }
      try {
        const id = await insertProduct({ product: { ...p.product, status }, variants: p.variants, images })
        created.push({ id, name: p.name, sizes: p.variants.length, photos: images.length })
      } catch {
        await removeStored(images)
        failed.push({ name: p.name, rows: p.rows, message: 'We could not save this product. Please try again.' })
      }
    }
  }
  await Promise.all([worker(), worker(), worker()])

  res.json({
    status,
    created: created.length,
    products: created,
    failed,
    warnings,
    skipped_rows: summary.rows_with_errors,
  })
})

export default router

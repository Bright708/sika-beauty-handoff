import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { db } from '../lib/supabase.js'
import { check, badRequest, notFound, HttpError } from '../lib/http.js'
import { effectivePrice } from '../lib/catalog.js'
import { initializeTransaction, verifyTransaction } from '../lib/paystack.js'
import { findOrderByReference, confirmPayment, publicOrder, PENDING_LIMIT_MS, expirePendingOrders } from '../lib/orders.js'

const router = Router()
const MAX_LINES = 30
const MAX_QTY = 20
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------- small in-memory rate limit (per IP) so nobody can flood us with orders ----------
const hits = new Map()
function limit(max, windowMs) {
  return (req, _res, next) => {
    const now = Date.now()
    const key = `${req.path}:${req.ip}`
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs)
    if (list.length >= max) throw new HttpError(429, 'Too many tries. Please wait a few minutes and try again.')
    list.push(now)
    hits.set(key, list)
    if (hits.size > 5000) hits.clear()
    next()
  }
}

const newReference = () => `sika_${randomBytes(12).toString('base64url')}`
const siteUrl = () => (process.env.PUBLIC_SITE_URL || (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0]).trim().replace(/\/+$/, '')
const label = (v) => `${v.product.name} ${v.size_label}`

// Load live variants with their product. Returns Map(id -> variant).
async function loadVariants(ids) {
  if (!ids.length) return new Map()
  const rows = check(
    await db
      .from('product_variants')
      .select('id, size_label, price_ghs, sale_price_ghs, stock, product:products!inner ( id, name, slug, status, images:product_images ( storage_path, sort ) )')
      .in('id', ids)
      .eq('product.status', 'live'),
    'variants',
  )
  return new Map(rows.map((v) => [v.id, v]))
}

// Compare wanted quantities with stock. Returns a list of problems (empty = all fine).
function stockProblems(lines, variants) {
  const issues = []
  for (const { variant_id, qty } of lines) {
    const v = variants.get(variant_id)
    if (!v) {
      issues.push({ variant_id, available: 0, message: 'Something in your bag is no longer available.' })
    } else if (v.stock < qty) {
      issues.push({
        variant_id,
        available: v.stock,
        message: v.stock === 0 ? `${label(v)} has just sold out.` : `Only ${v.stock} left of ${label(v)}.`,
      })
    }
  }
  return issues
}
function throwStock(issues) {
  const message =
    issues.length === 1 ? `${issues[0].message} We updated your bag.` : `Some items in your bag changed. ${issues[0].message} We updated your bag.`
  throw new HttpError(409, message, { stock_issues: issues.map(({ variant_id, available }) => ({ variant_id, available })) })
}

// +233 numbers: "024 123 4567", "0241234567", "233241234567", "+233 24 123 4567" -> "+233241234567".
// Numbers from other countries are kept if they start with +.
export function normalizePhone(input) {
  const raw = String(input ?? '').trim()
  const digits = raw.replace(/[^\d]/g, '')
  if (raw.startsWith('+') && !digits.startsWith('233')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  let local = digits
  if (local.startsWith('233')) local = local.slice(3)
  if (local.startsWith('0')) local = local.slice(1)
  return /^[235]\d{8}$/.test(local) ? `+233${local}` : null
}

const text = (v, max) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s.slice(0, max) : null
}

// ---------- GET /api/variants?ids=a,b : bag drawer details (public, live only) ----------
router.get('/variants', async (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => UUID.test(s))
    .slice(0, 50)
  const variants = await loadVariants([...new Set(ids)])
  res.set('Cache-Control', 'no-store')
  res.json(
    [...variants.values()].map((v) => ({
      id: v.id,
      size_label: v.size_label,
      price_ghs: v.price_ghs,
      sale_price_ghs: v.sale_price_ghs,
      stock: v.stock,
      product: {
        id: v.product.id,
        name: v.product.name,
        slug: v.product.slug,
        image: [...(v.product.images || [])].sort((a, b) => a.sort - b.sort)[0] || null,
      },
    })),
  )
})

// ---------- POST /api/checkout/initialize ----------
router.post('/checkout/initialize', limit(15, 10 * 60 * 1000), async (req, res) => {
  const b = req.body || {}
  const errors = {}

  // Bag: merge repeats, sane quantities
  const merged = new Map()
  for (const it of Array.isArray(b.items) ? b.items.slice(0, MAX_LINES) : []) {
    const id = String(it?.variant_id || '')
    const qty = Number(it?.qty)
    if (!UUID.test(id) || !Number.isInteger(qty) || qty < 1) continue
    merged.set(id, Math.min((merged.get(id) || 0) + qty, MAX_QTY))
  }
  const lines = [...merged].map(([variant_id, qty]) => ({ variant_id, qty }))
  if (!lines.length) throw badRequest('Your bag is empty.')

  const customer_name = text(b.customer_name, 80)
  if (!customer_name || customer_name.length < 2) errors.customer_name = 'Please enter your full name.'
  const phone = normalizePhone(b.phone)
  if (!phone) errors.phone = 'Enter a phone number we can WhatsApp, like 024 123 4567.'
  const email = text(b.email, 254)?.toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Enter your email so Paystack can send your receipt.'

  const fulfilment = b.fulfilment === 'pickup' ? 'pickup' : 'delivery'
  const [settingsRes, zonesRes] = await Promise.all([
    db.from('settings').select('free_delivery_threshold_ghs').eq('id', true).maybeSingle(),
    db.from('delivery_zones').select('id, name, fee_ghs'),
  ])
  const settings = check(settingsRes, 'settings') || {}
  const zones = check(zonesRes, 'zones')
  let zone = null
  let area = null
  if (fulfilment === 'delivery') {
    zone = zones.find((z) => z.id === Number(b.delivery_zone_id))
    if (!zone) errors.delivery_zone_id = 'Choose your delivery area.'
    area = text(b.area, 200)
    if (!area) errors.area = 'Tell us the area or a landmark so the rider can find you.'
  }
  const gift_message = b.is_gift ? text(b.gift_message, 200) : null
  if (b.is_gift && typeof b.gift_message === 'string' && b.gift_message.trim().length > 200)
    errors.gift_message = 'Keep the card message under 200 characters.'

  if (Object.keys(errors).length) throw badRequest('Please check the highlighted details.', { errors })

  // Recompute everything from the database. Never trust prices from the browser.
  const variants = await loadVariants(lines.map((l) => l.variant_id))
  const issues = stockProblems(lines, variants)
  if (issues.length) throwStock(issues)

  const items = lines.map(({ variant_id, qty }) => {
    const v = variants.get(variant_id)
    return {
      variant_id,
      product_name: v.product.name,
      size_label: v.size_label,
      unit_price_ghs: effectivePrice(v),
      quantity: qty,
    }
  })
  const subtotal = items.reduce((n, i) => n + i.unit_price_ghs * i.quantity, 0)
  const threshold = settings.free_delivery_threshold_ghs
  const delivery_fee = fulfilment === 'pickup' || (threshold != null && subtotal >= threshold) ? 0 : zone.fee_ghs
  const total = subtotal + delivery_fee

  const reference = newReference()
  const order = {
    customer_name,
    phone,
    email,
    fulfilment,
    delivery_zone: zone?.name || null,
    delivery_fee_ghs: delivery_fee,
    area,
    gps_address: fulfilment === 'delivery' ? text(b.gps_address, 40) : null,
    notes: text(b.notes, 500),
    gift_message,
    subtotal_ghs: subtotal,
    total_ghs: total,
  }
  const created = check(
    await db.rpc('create_pending_order', { p_order: order, p_items: items, p_reference: reference }),
    'create order',
  )
  const { order_id, order_number } = Array.isArray(created) ? created[0] : created

  let tx
  try {
    tx = await initializeTransaction({
      email,
      amountGhs: total,
      reference,
      callbackUrl: `${siteUrl()}/order/${reference}`,
      metadata: { order_id, order_number, cancel_action: `${siteUrl()}/checkout` },
    })
  } catch (err) {
    await db.from('orders').update({ payment_status: 'failed' }).eq('id', order_id)
    throw err
  }

  res.json({ access_code: tx.access_code, reference, order_number, total_ghs: total })
})

// ---------- GET /api/checkout/verify/:reference ----------
router.get('/checkout/verify/:reference', limit(60, 5 * 60 * 1000), async (req, res) => {
  const reference = req.params.reference
  let order = await findOrderByReference(reference)
  if (!order) throw notFound('We could not find that order.')

  if (order.payment_status !== 'paid') {
    let tx = null
    try {
      tx = await verifyTransaction(reference)
    } catch {
      // Paystack unreachable or the reference was never used: show the order as it stands.
    }
    const paid = tx ? await confirmPayment(order, reference, tx) : false
    if (!paid && order.payment_status === 'pending' && Date.now() - new Date(order.payment_started_at) > PENDING_LIMIT_MS) {
      await expirePendingOrders()
    }
    order = await findOrderByReference(reference)
  }
  res.set('Cache-Control', 'no-store')
  res.json(publicOrder(order))
})

// ---------- POST /api/checkout/retry/:reference : "Try again" on the same order ----------
router.post('/checkout/retry/:reference', limit(10, 10 * 60 * 1000), async (req, res) => {
  const order = await findOrderByReference(req.params.reference)
  if (!order) throw notFound('We could not find that order.')
  if (order.payment_status === 'paid') throw badRequest('This order is already paid.')

  // Stock may have changed since the order was made
  const wanted = new Map()
  for (const i of order.items) {
    if (!i.variant_id) throw new HttpError(409, 'Something in this order is no longer available. Please start a new order.')
    wanted.set(i.variant_id, (wanted.get(i.variant_id) || 0) + i.quantity)
  }
  const lines = [...wanted].map(([variant_id, qty]) => ({ variant_id, qty }))
  const issues = stockProblems(lines, await loadVariants(lines.map((l) => l.variant_id)))
  if (issues.length) {
    throw new HttpError(409, `${issues[0].message} Please start a new order from your bag.`)
  }

  const reference = newReference()
  check(await db.rpc('new_payment_attempt', { p_order_id: order.id, p_reference: reference }), 'retry')
  const tx = await initializeTransaction({
    email: order.email,
    amountGhs: order.total_ghs,
    reference,
    callbackUrl: `${siteUrl()}/order/${reference}`,
    metadata: { order_id: order.id, order_number: order.order_number, retry: true },
  })
  res.json({ access_code: tx.access_code, reference, order_number: order.order_number, total_ghs: order.total_ghs })
})

export default router

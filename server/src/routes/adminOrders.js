import { Router } from 'express'
import { db } from '../lib/supabase.js'
import { check, notFound, badRequest, HttpError, intParam } from '../lib/http.js'
import { requireAdmin } from '../lib/auth.js'
import { normalizePhone } from './checkout.js'

// Admin: orders, overview stats and shop settings. Mounted at /api/admin.
const router = Router()
router.use(requireAdmin)
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

export const LOW_STOCK = 3
const PAGE_SIZE = 50
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const LIST_SELECT = `
  id, order_number, customer_name, phone, fulfilment, delivery_zone, total_ghs,
  payment_status, status, needs_attention, paid_at, created_at,
  items:order_items ( quantity )
`
const DETAIL_SELECT = `
  id, order_number, customer_name, phone, email, fulfilment, delivery_zone, delivery_fee_ghs, area,
  gps_address, notes, gift_message, subtotal_ghs, total_ghs, payment_status, status, needs_attention,
  paystack_reference, paid_at, payment_started_at, created_at,
  items:order_items ( id, variant_id, product_name, size_label, unit_price_ghs, quantity ),
  attempts:payment_attempts ( reference, created_at )
`

// Filter chips. "new" = paid and waiting to be packed. "unpaid" = abandoned or failed payments.
const FILTERS = {
  new: (q) => q.eq('payment_status', 'paid').eq('status', 'new'),
  paid: (q) => q.eq('payment_status', 'paid'),
  out_for_delivery: (q) => q.eq('payment_status', 'paid').eq('status', 'out_for_delivery'),
  delivered: (q) => q.eq('payment_status', 'paid').eq('status', 'delivered'),
  cancelled: (q) => q.eq('status', 'cancelled'),
  unpaid: (q) => q.neq('payment_status', 'paid'),
  attention: (q) => q.eq('needs_attention', true),
}

async function orderCounts() {
  const keys = Object.keys(FILTERS)
  const results = await Promise.all(
    keys.map((k) => FILTERS[k](db.from('orders').select('id', { count: 'exact', head: true }))),
  )
  results.forEach((r) => check(r, 'order counts'))
  return Object.fromEntries(keys.map((k, i) => [k, results[i].count ?? 0]))
}

const listRow = ({ items, ...o }) => ({ ...o, item_count: (items || []).reduce((n, i) => n + i.quantity, 0) })

// ---------- GET /api/admin/orders/counts : for the sidebar badge ----------
router.get('/orders/counts', async (_req, res) => {
  res.json(await orderCounts())
})

// ---------- GET /api/admin/orders?filter=new&q=&page=1 ----------
router.get('/orders', async (req, res) => {
  const filter = FILTERS[req.query.filter] ? req.query.filter : 'new'
  const page = intParam(req.query.page, { min: 1, max: 1000, fallback: 1 })
  // Search by order number, name or phone. Keep only safe characters for the filter syntax.
  const q = String(req.query.q || '')
    .replace(/[^\p{L}\p{N} +-]/gu, '')
    .trim()
    .slice(0, 60)

  let query = FILTERS[filter](db.from('orders').select(LIST_SELECT, { count: 'exact' }))
  if (q) {
    const digits = q.replace(/\D/g, '').replace(/^0/, '')
    const parts = [`order_number.ilike.%${q}%`, `customer_name.ilike.%${q}%`]
    if (digits.length >= 4) parts.push(`phone.ilike.%${digits}%`)
    query = query.or(parts.join(','))
  }
  const from = (page - 1) * PAGE_SIZE
  const sortCol = filter === 'unpaid' || filter === 'cancelled' ? 'created_at' : 'paid_at'
  const [list, counts] = await Promise.all([
    query.order(sortCol, { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1),
    orderCounts(),
  ])
  const rows = check(list, 'orders')
  res.json({ filter, page, page_size: PAGE_SIZE, total: list.count ?? rows.length, orders: rows.map(listRow), counts })
})

async function loadOrder(id) {
  if (!UUID.test(id)) throw notFound('We could not find that order.')
  const o = check(await db.from('orders').select(DETAIL_SELECT).eq('id', id).maybeSingle(), 'order')
  if (!o) throw notFound('We could not find that order.')
  o.attempts = [...(o.attempts || [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return o
}

// ---------- GET /api/admin/orders/:id ----------
router.get('/orders/:id', async (req, res) => {
  res.json(await loadOrder(req.params.id))
})

// ---------- PATCH /api/admin/orders/:id  { status } or { needs_attention: false } ----------
// Moves a paid order between new, out for delivery and delivered (back as well, to undo a slip).
// Cancelling has its own route because it can put stock back.
const MOVABLE = ['new', 'out_for_delivery', 'delivered']
router.patch('/orders/:id', async (req, res) => {
  const order = await loadOrder(req.params.id)
  const patch = {}
  if ('status' in req.body) {
    if (!MOVABLE.includes(req.body.status)) throw badRequest('That is not an order status we know.')
    if (order.payment_status !== 'paid') throw badRequest('This order has not been paid, so it cannot be sent out.')
    if (order.status === 'cancelled') throw badRequest('This order was cancelled.')
    patch.status = req.body.status
  }
  if (req.body.needs_attention === false) patch.needs_attention = false
  if (!Object.keys(patch).length) throw badRequest('Nothing to change.')

  let q = db.from('orders').update(patch).eq('id', order.id)
  if (patch.status) q = q.eq('payment_status', 'paid').neq('status', 'cancelled')
  const updated = check(await q.select('id'), 'order update')
  if (!updated.length) throw new HttpError(409, 'This order changed in the meantime. Refresh and try again.')
  res.json(await loadOrder(order.id))
})

// ---------- POST /api/admin/orders/:id/cancel  { restock } ----------
router.post('/orders/:id/cancel', async (req, res) => {
  const order = await loadOrder(req.params.id)
  const { data, error } = await db.rpc('cancel_order', { p_order_id: order.id, p_restock: req.body?.restock !== false })
  if (error) {
    if (error.code === 'P0001') throw badRequest('Only paid orders that are not delivered yet can be cancelled.')
    check({ error }, 'cancel order')
  }
  const row = Array.isArray(data) ? data[0] : data
  console.log(`[orders] ${order.order_number} cancelled by ${req.admin.email}, restocked ${row?.restocked ?? 0}`)
  res.json({ ...(await loadOrder(order.id)), restocked: row?.restocked ?? 0 })
})

// ---------- GET /api/admin/overview ----------
// Ghana is on GMT all year, so "today" starts at midnight UTC.
router.get('/overview', async (_req, res) => {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const [today, unfulfilled, attention, latest, low] = await Promise.all([
    db.from('orders').select('total_ghs').eq('payment_status', 'paid').neq('status', 'cancelled').gte('paid_at', start.toISOString()),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'paid').in('status', ['new', 'out_for_delivery']),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('needs_attention', true),
    db.from('orders').select(LIST_SELECT).eq('payment_status', 'paid').order('paid_at', { ascending: false }).limit(5),
    db
      .from('product_variants')
      .select('id, size_label, stock, product:products!inner ( id, name, status )')
      .lte('stock', LOW_STOCK)
      .eq('product.status', 'live')
      .order('stock')
      .limit(50),
  ])
  const todayRows = check(today, 'overview today')
  const lowRows = check(low, 'overview low stock')
  check(unfulfilled, 'overview unfulfilled')
  check(attention, 'overview attention')
  res.json({
    sales_today_ghs: todayRows.reduce((n, o) => n + o.total_ghs, 0),
    orders_today: todayRows.length,
    unfulfilled: unfulfilled.count ?? 0,
    needs_attention: attention.count ?? 0,
    low_stock_products: new Set(lowRows.map((v) => v.product.id)).size,
    low_stock: lowRows.map((v) => ({ variant_id: v.id, product_id: v.product.id, name: v.product.name, size_label: v.size_label, stock: v.stock })),
    latest: check(latest, 'overview latest').map(listRow),
  })
})

// ---------- settings ----------
async function loadSettings() {
  const [s, z] = await Promise.all([
    db
      .from('settings')
      .select('shop_name, whatsapp, pickup_address, pickup_hours, cutoff_time, free_delivery_threshold_ghs, updated_at')
      .eq('id', true)
      .maybeSingle(),
    db.from('delivery_zones').select('id, name, fee_ghs, sort').order('sort').order('id'),
  ])
  return { ...(check(s, 'settings') || {}), delivery_zones: check(z, 'zones') }
}

router.get('/settings', async (_req, res) => {
  res.json(await loadSettings())
})

const text = (v, max) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s.slice(0, max) : ''
}
const wholeCedis = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null
  const s = String(v).replace(/[,\s]/g, '').replace(/^gh₵|^ghs/i, '')
  return /^\d+$/.test(s) ? Number(s) : NaN
}

export function parseSettings(b) {
  const errors = {}
  const shop_name = text(b.shop_name, 60)
  if (!shop_name) errors.shop_name = 'Please enter the shop name.'

  const phone = normalizePhone(b.whatsapp)
  if (!phone) errors.whatsapp = 'Enter the WhatsApp number customers should message, like 024 123 4567.'
  const whatsapp = phone ? phone.replace(/^\+/, '') : ''

  const threshold = wholeCedis(b.free_delivery_threshold_ghs)
  if (Number.isNaN(threshold) || threshold === 0 || threshold > 1_000_000)
    errors.free_delivery_threshold_ghs = 'Use a whole number in cedis, like 500, or leave it empty.'

  const zonesIn = Array.isArray(b.delivery_zones) ? b.delivery_zones : []
  if (!zonesIn.length) errors.delivery_zones = 'Add at least one delivery area, or customers cannot choose delivery.'
  if (zonesIn.length > 30) errors.delivery_zones = 'You can have up to 30 delivery areas.'
  const seen = new Set()
  const delivery_zones = zonesIn.slice(0, 30).map((z, i) => {
    const name = text(z?.name, 60)
    const fee = wholeCedis(z?.fee_ghs)
    if (!name) errors[`zones.${i}.name`] = 'Name this area.'
    else if (seen.has(name.toLowerCase())) errors[`zones.${i}.name`] = 'This area is listed twice.'
    seen.add(name.toLowerCase())
    if (fee === null || Number.isNaN(fee) || fee > 10_000) errors[`zones.${i}.fee_ghs`] = 'Fee in whole cedis, like 30. Use 0 for free.'
    const id = Number.isInteger(Number(z?.id)) && Number(z?.id) > 0 ? Number(z.id) : null
    return { id, name, fee_ghs: fee }
  })

  return {
    errors,
    settings: {
      shop_name,
      whatsapp,
      pickup_address: text(b.pickup_address, 200),
      pickup_hours: text(b.pickup_hours, 100),
      cutoff_time: text(b.cutoff_time, 40),
      free_delivery_threshold_ghs: Number.isNaN(threshold) ? null : threshold,
    },
    delivery_zones,
  }
}

router.put('/settings', async (req, res) => {
  const { errors, settings, delivery_zones } = parseSettings(req.body || {})
  if (Object.keys(errors).length) throw badRequest('Please check the highlighted details.', { errors })
  check(await db.rpc('save_settings', { p_settings: settings, p_zones: delivery_zones }), 'save settings')
  res.json(await loadSettings())
})

export default router

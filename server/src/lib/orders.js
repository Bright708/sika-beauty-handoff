import { db } from './supabase.js'
import { check } from './http.js'
import { sendOrderEmails } from './email.js'

const ORDER_SELECT = `
  id, order_number, customer_name, phone, email, fulfilment, delivery_zone, delivery_fee_ghs, area,
  gps_address, notes, gift_message, subtotal_ghs, total_ghs, payment_status, status, needs_attention,
  paystack_reference, paid_at, payment_started_at, created_at,
  items:order_items ( id, variant_id, product_name, size_label, unit_price_ghs, quantity )
`

// Any of an order's payment references (each "Try again" adds one) finds the order.
export async function findOrderByReference(reference) {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(reference || '')) return null
  const attempt = check(
    await db.from('payment_attempts').select('order_id').eq('reference', reference).maybeSingle(),
    'attempt',
  )
  if (!attempt) return null
  return check(await db.from('orders').select(ORDER_SELECT).eq('id', attempt.order_id).maybeSingle(), 'order')
}

export const PENDING_LIMIT_MS = 30 * 60 * 1000

// Mark paid after checking Paystack's numbers against our order. Safe to call twice
// (verify and webhook can both arrive): the database function is idempotent.
// Returns true when the order is (now) paid.
export async function confirmPayment(order, reference, tx) {
  const amountOk = Number(tx?.amount) === order.total_ghs * 100
  const currencyOk = tx?.currency === 'GHS'
  if (tx?.status !== 'success') return false
  if (!amountOk || !currencyOk) {
    // Never mark paid on a mismatch. Flag it so the owner looks at it.
    console.error('[payment] mismatch', order.order_number, reference, tx?.amount, tx?.currency)
    await db.from('orders').update({ needs_attention: true }).eq('id', order.id)
    return false
  }
  const { data, error } = await db.rpc('mark_order_paid', { p_reference: reference })
  if (error) {
    console.error('[payment] mark_order_paid', error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  if (row && !row.already_paid) {
    console.log(`[payment] ${row.order_number} paid${row.needs_attention ? ' (needs attention: stock ran out)' : ''}`)
    sendOrderEmails(order.id).catch((err) => console.error('[email]', err.message))
  }
  return true
}

// What the confirmation page may show. The reference in the URL acts as the key,
// so leave out phone and email.
export function publicOrder(o) {
  return {
    order_number: o.order_number,
    payment_status: o.payment_status,
    status: o.status,
    first_name: (o.customer_name || '').trim().split(/\s+/)[0],
    fulfilment: o.fulfilment,
    delivery_zone: o.delivery_zone,
    area: o.area,
    gift_message: o.gift_message,
    subtotal_ghs: o.subtotal_ghs,
    delivery_fee_ghs: o.delivery_fee_ghs,
    total_ghs: o.total_ghs,
    paid_at: o.paid_at,
    items: (o.items || []).map(({ product_name, size_label, unit_price_ghs, quantity }) => ({
      product_name,
      size_label,
      unit_price_ghs,
      quantity,
    })),
  }
}

// Pending orders older than 30 minutes become failed. Runs on a timer in index.js.
export async function expirePendingOrders() {
  const { data, error } = await db.rpc('expire_pending_orders')
  if (error) console.error('[orders] expire', error.message)
  else if (data > 0) console.log(`[orders] marked ${data} unpaid order(s) as failed`)
}

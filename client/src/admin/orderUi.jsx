import { Link, useNavigate } from 'react-router-dom'
import { formatGHS } from '../lib/format'
import { StatusPill } from './ui'

// Shared bits for the Orders, Order detail and Overview pages.

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return ''
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d} ${d === 1 ? 'day' : 'days'} ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const fullDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    : ''

const PAYMENT = {
  paid: { label: 'Paid', tone: 'success' },
  pending: { label: 'Awaiting payment', tone: 'neutral' },
  failed: { label: 'Payment failed', tone: 'danger' },
}
export const ORDER_STATUS = {
  new: { label: 'New', tone: 'accent' },
  out_for_delivery: { label: 'Out for delivery', tone: 'neutral' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}
// Pickup orders skip "out for delivery"; "delivered" reads as "Picked up".
export function statusLabel(o) {
  if (o.fulfilment === 'pickup' && o.status === 'delivered') return 'Picked up'
  return ORDER_STATUS[o.status]?.label || o.status
}

export const PaymentPill = ({ o }) => <StatusPill tone={PAYMENT[o.payment_status]?.tone}>{PAYMENT[o.payment_status]?.label}</StatusPill>
export const OrderStatusPill = ({ o }) =>
  o.payment_status === 'paid' || o.status === 'cancelled' ? (
    <StatusPill tone={ORDER_STATUS[o.status]?.tone}>{statusLabel(o)}</StatusPill>
  ) : null

export const AttentionPill = () => <StatusPill tone="danger">Needs attention</StatusPill>

// "+233241234567" -> "024 123 4567"; other countries stay international
export function displayPhone(p) {
  const m = /^\+233(\d{2})(\d{3})(\d{4})$/.exec(p || '')
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : p
}

export function waCustomer(o, shopName) {
  const first = (o.customer_name || '').trim().split(/\s+/)[0]
  const text = `Hi ${first}, this is ${shopName} about your order ${o.order_number}.`
  return `https://wa.me/${(o.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

export const where = (o) => (o.fulfilment === 'pickup' ? 'Pick up' : o.delivery_zone || 'Delivery')

// Cards on phones, a table from 640px. Row click opens the order.
export function OrderRows({ orders, shopName, compact = false }) {
  const navigate = useNavigate()
  const items = (o) => `${o.item_count} ${o.item_count === 1 ? 'item' : 'items'}`
  const when = (o) => timeAgo(o.paid_at || o.created_at)
  return (
    <>
      <ul className="sm:hidden m-0 p-0 list-none flex flex-col gap-2.5">
        {orders.map((o) => (
          <li key={o.id} className="bg-white rounded-admin">
            <Link to={`/admin/orders/${o.id}`} className="flex flex-col gap-2 p-4 no-underline text-ink">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-extrabold">{o.order_number}</span>
                <span className="text-[13px] text-muted">{when(o)}</span>
              </span>
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-bold truncate">{o.customer_name}</span>
                <span className="font-extrabold whitespace-nowrap">{formatGHS(o.total_ghs)}</span>
              </span>
              <span className="text-[14px] text-muted">
                {items(o)} · {where(o)}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {o.payment_status !== 'paid' && <PaymentPill o={o} />}
                <OrderStatusPill o={o} />
                {o.needs_attention && <AttentionPill />}
              </span>
            </Link>
            {/* Separate link, outside the card link, so it is its own tap target */}
            <a
              href={waCustomer(o, shopName)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center min-h-11 px-4 border-t border-line-soft text-[14px] font-bold text-ink no-underline"
            >
              WhatsApp {displayPhone(o.phone)}
            </a>
          </li>
        ))}
      </ul>

      <div className="hidden sm:block bg-white rounded-admin overflow-x-auto">
        <table className={`w-full border-collapse ${compact ? 'min-w-[640px]' : 'min-w-[900px]'}`}>
          <thead>
            <tr className="text-left text-[13px] text-muted">
              <th scope="col" className="pl-5 pr-3 py-4 font-bold">Order</th>
              <th scope="col" className="px-3 py-4 font-bold">Customer</th>
              {!compact && <th scope="col" className="px-3 py-4 font-bold">Items</th>}
              <th scope="col" className="px-3 py-4 font-bold">Total</th>
              {!compact && <th scope="col" className="px-3 py-4 font-bold">Delivery</th>}
              {!compact && <th scope="col" className="px-3 py-4 font-bold">Payment</th>}
              <th scope="col" className="px-3 py-4 font-bold">Status</th>
              <th scope="col" className="pl-3 pr-5 py-4 font-bold text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                onClick={(e) => {
                  if (!e.target.closest('a,button')) navigate(`/admin/orders/${o.id}`)
                }}
                className="border-t border-line-soft cursor-pointer hover:bg-paper align-top"
              >
                <td className="pl-5 pr-3 py-3.5">
                  <Link to={`/admin/orders/${o.id}`} className="inline-block py-3 -my-3 font-extrabold text-ink no-underline hover:underline underline-offset-2">
                    {o.order_number}
                  </Link>
                </td>
                <td className="px-3 py-3.5">
                  <span className="flex flex-col">
                    <span className="font-bold">{o.customer_name}</span>
                    <a
                      href={waCustomer(o, shopName)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`WhatsApp ${o.customer_name} on ${displayPhone(o.phone)}`}
                      className="text-[13px] text-muted-2 underline underline-offset-2 hover:text-ink"
                    >
                      {displayPhone(o.phone)}
                    </a>
                  </span>
                </td>
                {!compact && <td className="px-3 py-3.5 text-muted-2 whitespace-nowrap">{items(o)}</td>}
                <td className="px-3 py-3.5 font-bold whitespace-nowrap">{formatGHS(o.total_ghs)}</td>
                {!compact && <td className="px-3 py-3.5 text-muted-2">{where(o)}</td>}
                {!compact && (
                  <td className="px-3 py-3.5">
                    <PaymentPill o={o} />
                  </td>
                )}
                <td className="px-3 py-3.5">
                  <span className="flex flex-wrap gap-1.5">
                    <OrderStatusPill o={o} />
                    {o.needs_attention && <AttentionPill />}
                  </span>
                </td>
                <td className="pl-3 pr-5 py-3.5 text-right text-[14px] text-muted whitespace-nowrap">{when(o)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

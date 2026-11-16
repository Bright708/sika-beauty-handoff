import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminFetch } from '../../lib/adminApi'
import { formatGHS } from '../../lib/format'
import { buttonClass } from '../../components/Button'
import { WhatsAppIcon } from '../../components/Icons'
import { useAdminCounts } from '../../stores/useAdminCounts'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { Card, ConfirmDialog, Notice, useDocTitle } from '../ui'
import { AttentionPill, OrderStatusPill, PaymentPill, displayPhone, fullDate, statusLabel, timeAgo, waCustomer } from '../orderUi'

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[13px] font-bold text-muted">{label}</dt>
      <dd className="m-0 break-words">{children}</dd>
    </div>
  )
}

// The next step for a paid order, as one clear primary button.
function nextStep(o) {
  if (o.payment_status !== 'paid') return null
  if (o.status === 'new' && o.fulfilment === 'pickup') return { status: 'delivered', label: 'Mark picked up' }
  if (o.status === 'new') return { status: 'out_for_delivery', label: 'Mark out for delivery' }
  if (o.status === 'out_for_delivery') return { status: 'delivered', label: 'Mark delivered' }
  return null
}
function stepBack(o) {
  if (o.payment_status !== 'paid') return null
  if (o.status === 'out_for_delivery') return { status: 'new', label: 'Move back to New' }
  if (o.status === 'delivered')
    return o.fulfilment === 'pickup'
      ? { status: 'new', label: 'Undo: not picked up yet' }
      : { status: 'out_for_delivery', label: 'Undo: back to Out for delivery' }
  return null
}

export default function OrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [restock, setRestock] = useState(true)
  const [copied, setCopied] = useState(false)
  const refreshCounts = useAdminCounts((s) => s.refresh)
  const shopName = useSettingsStore((s) => s.settings.shop_name)
  useDocTitle(order ? `Order ${order.order_number}` : 'Order')

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setOrder(await adminFetch(`/orders/${id}`))
    } catch (err) {
      setLoadError(err)
    }
  }, [id])
  useEffect(() => {
    load()
  }, [load])

  async function change(body, success) {
    setBusy(true)
    setMessage(null)
    try {
      const o = await adminFetch(`/orders/${id}`, { method: 'PATCH', body })
      setOrder(o)
      setMessage({ tone: 'success', text: success(o) })
      refreshCounts()
    } catch (err) {
      setMessage({ tone: 'danger', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    setBusy(true)
    setMessage(null)
    try {
      const o = await adminFetch(`/orders/${id}/cancel`, { method: 'POST', body: { restock } })
      setOrder(o)
      setMessage({
        tone: 'success',
        text: `Order cancelled.${o.restocked ? ` ${o.restocked} ${o.restocked === 1 ? 'item' : 'items'} put back in stock.` : ''} Refund the customer from your Paystack dashboard.`,
      })
      refreshCounts()
    } catch (err) {
      setMessage({ tone: 'danger', text: err.message })
    } finally {
      setBusy(false)
      setCancelOpen(false)
    }
  }

  async function copyRef() {
    try {
      await navigator.clipboard.writeText(order.paystack_reference)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the reference is on screen to copy by hand.
    }
  }

  const back = (
    <Link to="/admin/orders" className="self-start inline-flex items-center min-h-11 text-[14px] font-bold text-muted-2 no-underline hover:text-ink">
      ← All orders
    </Link>
  )

  if (loadError) {
    return (
      <>
        {back}
        <div className="bg-white rounded-admin p-6 flex flex-col gap-3 items-start">
          <Notice tone="danger">{loadError.message}</Notice>
          {loadError.status !== 404 && (
            <button type="button" onClick={load} className={buttonClass({ variant: 'secondary', size: 'md' })}>
              Try again
            </button>
          )}
        </div>
      </>
    )
  }
  if (!order) {
    return (
      <>
        {back}
        <div className="bg-white rounded-admin p-6 text-muted" role="status">
          Loading order...
        </div>
      </>
    )
  }

  const o = order
  const next = nextStep(o)
  const prev = stepBack(o)
  const canCancel = o.payment_status === 'paid' && (o.status === 'new' || o.status === 'out_for_delivery')
  const itemCount = o.items.reduce((n, i) => n + i.quantity, 0)

  return (
    <>
      {back}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="m-0 font-display font-normal text-[40px] leading-[1.1]">{o.order_number}</h1>
          <span className="flex flex-wrap gap-1.5">
            <PaymentPill o={o} />
            <OrderStatusPill o={o} />
            {o.needs_attention && <AttentionPill />}
          </span>
        </div>
        <span className="text-muted">
          {o.paid_at ? `Paid ${timeAgo(o.paid_at)} · ${fullDate(o.paid_at)}` : `Started ${timeAgo(o.created_at)} · ${fullDate(o.created_at)}`}
        </span>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {o.needs_attention && (
        <div className="flex flex-col gap-3 items-start px-5 py-4 rounded-admin bg-danger-bg text-danger">
          <p className="m-0 font-bold">
            {o.payment_status === 'paid'
              ? 'This order was paid, but some items were out of stock by the time the payment came through. Check the items below, then WhatsApp the customer to offer a swap or a refund.'
              : 'Paystack reported a payment that did not match this order (wrong amount or currency), so it was not marked paid. Check the reference in your Paystack dashboard.'}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => change({ needs_attention: false }, () => 'Marked as sorted.')}
            className="min-h-11 px-4 rounded-full bg-white text-danger border-0 font-bold cursor-pointer disabled:opacity-60"
          >
            Mark as sorted
          </button>
        </div>
      )}

      {o.payment_status !== 'paid' && o.status !== 'cancelled' && (
        <Notice tone="danger">
          {o.payment_status === 'pending'
            ? 'Not paid yet. The customer may still be paying. Do not send anything until it shows Paid.'
            : 'Not paid. The payment failed or the customer stopped. Nothing to send.'}
        </Notice>
      )}

      <div className="grid gap-5 nav:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <Card title={`Items (${itemCount})`}>
            <ul className="m-0 p-0 list-none flex flex-col">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-3 border-b border-line-soft last:border-0">
                  <span className="flex flex-col">
                    <span className="font-bold">{i.product_name}</span>
                    <span className="text-[14px] text-muted">
                      {i.size_label} · {formatGHS(i.unit_price_ghs)} × {i.quantity}
                    </span>
                  </span>
                  <span className="font-bold whitespace-nowrap">{formatGHS(i.unit_price_ghs * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="m-0 flex flex-col gap-2 pt-1">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="m-0 font-bold">{formatGHS(o.subtotal_ghs)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{o.fulfilment === 'pickup' ? 'Pick up' : 'Delivery'}</dt>
                <dd className="m-0 font-bold">{o.delivery_fee_ghs ? formatGHS(o.delivery_fee_ghs) : 'Free'}</dd>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-line-soft">
                <dt className="font-extrabold">{o.payment_status === 'paid' ? 'Total paid' : 'Total'}</dt>
                <dd className="m-0 font-extrabold text-[22px]">{formatGHS(o.total_ghs)}</dd>
              </div>
            </dl>
          </Card>

          <Card title={o.fulfilment === 'pickup' ? 'Pick up' : 'Delivery'}>
            <dl className="m-0 grid gap-4 sm:grid-cols-2">
              {o.fulfilment === 'pickup' ? (
                <Row label="How">Customer picks up from you</Row>
              ) : (
                <>
                  <Row label="Area">{o.delivery_zone || '-'}</Row>
                  <Row label="Area or landmark">{o.area || '-'}</Row>
                  <Row label="GhanaPost GPS">{o.gps_address || 'Not given'}</Row>
                </>
              )}
              <Row label="Notes">{o.notes || 'None'}</Row>
            </dl>
            {o.gift_message && (
              <div className="p-4 rounded-input bg-blush flex flex-col gap-1">
                <span className="text-[13px] font-bold">Gift. Write this on the card:</span>
                <span className="text-[17px]">"{o.gift_message}"</span>
              </div>
            )}
          </Card>

          <Card title="Payment">
            <dl className="m-0 grid gap-4 sm:grid-cols-2">
              <Row label="Status">
                <PaymentPill o={o} />
              </Row>
              <Row label="Paystack reference">
                <span className="flex flex-wrap items-center gap-2">
                  <code className="text-[14px] break-all">{o.paystack_reference}</code>
                  <button
                    type="button"
                    onClick={copyRef}
                    className="min-h-11 px-3 rounded-full border-[1.5px] border-field bg-white text-[13px] font-bold cursor-pointer hover:border-ink"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </span>
              </Row>
              {o.attempts.length > 1 && (
                <Row label="Payment tries">
                  {o.attempts.length} (the customer pressed "Try again")
                </Row>
              )}
              <Row label="Placed">{fullDate(o.created_at)}</Row>
            </dl>
          </Card>
        </div>

        <div className="flex flex-col gap-5 nav:sticky nav:top-8">
          <Card title="Customer">
            <dl className="m-0 flex flex-col gap-3">
              <Row label="Name">{o.customer_name}</Row>
              <Row label="Phone">
                <a href={`tel:${o.phone}`} className="text-ink">
                  {displayPhone(o.phone)}
                </a>
              </Row>
              <Row label="Email">
                <a href={`mailto:${o.email}`} className="text-ink">
                  {o.email}
                </a>
              </Row>
            </dl>
            <a href={waCustomer(o, shopName)} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'secondary', size: 'md', className: 'w-full' })}>
              <WhatsAppIcon size={18} />
              WhatsApp customer
            </a>
          </Card>

          {(next || prev || canCancel) && (
            <Card title="Update order" subtitle={o.payment_status === 'paid' ? `Now: ${statusLabel(o)}` : undefined}>
              {next && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => change({ status: next.status }, (x) => `${x.order_number} is now ${statusLabel(x).toLowerCase()}.`)}
                  className={buttonClass({ size: 'md', className: 'w-full' })}
                >
                  {busy ? 'Saving...' : next.label}
                </button>
              )}
              {next?.status === 'out_for_delivery' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => change({ status: 'delivered' }, (x) => `${x.order_number} is now delivered.`)}
                  className={buttonClass({ variant: 'secondary', size: 'md', className: 'w-full' })}
                >
                  Mark delivered
                </button>
              )}
              {prev && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => change({ status: prev.status }, (x) => `${x.order_number} moved back to ${statusLabel(x).toLowerCase()}.`)}
                  className="self-start min-h-11 bg-transparent border-0 px-0 font-bold text-muted-2 underline underline-offset-4 cursor-pointer hover:text-ink"
                >
                  {prev.label}
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setCancelOpen(true)}
                  className="self-start min-h-11 bg-transparent border-0 px-0 font-bold text-danger underline underline-offset-4 cursor-pointer"
                >
                  Cancel order
                </button>
              )}
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title={`Cancel ${o.order_number}?`}
        body="The customer is not refunded automatically. After cancelling, refund them from your Paystack dashboard and let them know on WhatsApp."
        confirmLabel="Cancel order"
        busyLabel="Cancelling..."
        cancelLabel="Keep order"
        busy={busy}
        onConfirm={cancel}
        onCancel={() => setCancelOpen(false)}
      >
        <label className="flex items-center gap-3 min-h-11 cursor-pointer font-bold">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="w-5 h-5 accent-ink" />
          Put the {itemCount === 1 ? 'item' : `${itemCount} items`} back in stock
        </label>
      </ConfirmDialog>
    </>
  )
}

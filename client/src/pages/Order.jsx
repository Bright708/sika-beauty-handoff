import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { retryOrder, verifyOrder } from '../lib/api'
import { payWithPaystack } from '../lib/paystack'
import { formatGHS } from '../lib/format'
import { buttonClass } from '../components/Button'
import { WhatsAppIcon } from '../components/Icons'
import { useBagStore } from '../stores/useBagStore'
import { useCheckoutStore } from '../stores/useCheckoutStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { waLink } from '../config/shop'

const POLL_MS = 3000
const POLL_TRIES = 20 // about a minute

function Items({ order }) {
  return (
    <div className="bg-white rounded-card p-5 sm:p-6 flex flex-col gap-4">
      <ul className="m-0 p-0 list-none flex flex-col gap-3">
        {order.items.map((i, n) => (
          <li key={n} className="flex justify-between gap-4">
            <span>
              <span className="font-bold">{i.product_name}</span>
              <span className="text-muted">
                {' '}
                · {i.size_label} · Qty {i.quantity}
              </span>
            </span>
            <span className="font-bold whitespace-nowrap">{formatGHS(i.unit_price_ghs * i.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="m-0 flex flex-col gap-2 pt-3 border-t border-line">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd className="m-0 font-bold">{formatGHS(order.subtotal_ghs)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{order.fulfilment === 'pickup' ? 'Pick up' : 'Delivery'}</dt>
          <dd className="m-0 font-bold">{order.delivery_fee_ghs ? formatGHS(order.delivery_fee_ghs) : 'Free'}</dd>
        </div>
        <div className="flex justify-between items-baseline pt-2 border-t border-line">
          <dt className="font-extrabold">{order.payment_status === 'paid' ? 'Total paid' : 'Total'}</dt>
          <dd className="m-0 font-extrabold text-[22px]">{formatGHS(order.total_ghs)}</dd>
        </div>
      </dl>
    </div>
  )
}

export default function Order() {
  const { reference } = useParams()
  const navigate = useNavigate()
  const settings = useSettingsStore((s) => s.settings)
  const clearBag = useBagStore((s) => s.clear)
  const { lastReference, resetAfterOrder } = useCheckoutStore()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null) // { status, message }
  const [tries, setTries] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const [retryMsg, setRetryMsg] = useState('')
  const cleared = useRef(false)

  const load = useCallback(async () => {
    try {
      const o = await verifyOrder(reference)
      setOrder(o)
      setError(null)
      return o
    } catch (err) {
      setError({ status: err.status, message: err.message })
      return null
    }
  }, [reference])

  // First load, then keep checking while Paystack confirms
  useEffect(() => {
    let alive = true
    let timer
    let n = 0
    const tick = async () => {
      const o = await load()
      if (!alive) return
      n += 1
      setTries(n)
      if (o?.payment_status === 'pending' && n < POLL_TRIES) timer = setTimeout(tick, POLL_MS)
    }
    tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [load])

  // Paid: empty the bag if this was the order just placed on this device
  useEffect(() => {
    if (order?.payment_status === 'paid' && !cleared.current && lastReference === reference) {
      cleared.current = true
      clearBag()
      resetAfterOrder()
    }
  }, [order, lastReference, reference, clearBag, resetAfterOrder])

  useEffect(() => {
    document.title = order?.payment_status === 'paid' ? `Order ${order.order_number} · Sika Beauty` : 'Your order · Sika Beauty'
  }, [order])

  async function tryAgain() {
    setRetryMsg('')
    setRetrying(true)
    try {
      const started = await retryOrder(reference)
      useCheckoutStore.getState().setLastReference(started.reference)
      const result = await payWithPaystack(started.access_code)
      if (result === 'success') navigate(`/order/${started.reference}`, { replace: true })
      else setRetryMsg('Payment cancelled. You can try again any time in the next 30 minutes.')
    } catch (err) {
      setRetryMsg(err.message)
    } finally {
      setRetrying(false)
    }
  }

  const wrap = (children) => <section className="container-shop pt-12 pb-24 max-w-[760px] flex flex-col gap-6">{children}</section>

  if (error && !order) {
    return wrap(
      <>
        <h1 className="m-0 font-display font-normal text-section">
          {error.status === 404 ? 'We could not find that order.' : 'We could not load your order.'}
        </h1>
        <p className="m-0 text-muted">
          {error.status === 404
            ? 'Check the link, or message us on WhatsApp with your order number.'
            : `${error.message} If you paid, your order is safe.`}
        </p>
        <div className="flex flex-wrap gap-3">
          {error.status !== 404 && (
            <button type="button" onClick={load} className={buttonClass()}>
              Try again
            </button>
          )}
          <a href={waLink(`Hi ${settings.shop_name}, I have a question about my order.`, settings.whatsapp)} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'secondary' })}>
            <WhatsAppIcon size={18} />
            WhatsApp us
          </a>
        </div>
      </>,
    )
  }

  if (!order) {
    return wrap(
      <p role="status" className="m-0 text-muted text-[17px]">
        Loading your order...
      </p>,
    )
  }

  const waAboutOrder = waLink(
    `Hi ${settings.shop_name}, my order ${order.order_number} (${formatGHS(order.total_ghs)}): ${order.items
      .map((i) => `${i.product_name} ${i.size_label} x${i.quantity}`)
      .join(', ')}.`,
    settings.whatsapp,
  )

  // ---------- paid ----------
  if (order.payment_status === 'paid') {
    return wrap(
      <>
        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-bold text-rose">Order {order.order_number}</span>
          <h1 className="m-0 font-display font-normal text-section">Thank you, {order.first_name}.</h1>
          <p className="m-0 text-muted-2 text-[17px]">Your payment went through and your order is in. We'll WhatsApp you when it's on the way.</p>
        </div>
        <Items order={order} />
        <div className="bg-white rounded-card p-5 sm:p-6 flex flex-col gap-1">
          <span className="font-bold">{order.fulfilment === 'pickup' ? 'Pick up' : 'Delivery'}</span>
          {order.fulfilment === 'pickup' ? (
            <>
              <span className="text-muted-2">{settings.pickup_address || 'We will send the pickup address on WhatsApp.'}</span>
              {settings.pickup_hours && <span className="text-muted-2">{settings.pickup_hours}</span>}
            </>
          ) : (
            <span className="text-muted-2">
              {order.area}
              {order.delivery_zone ? `, ${order.delivery_zone}` : ''}
            </span>
          )}
          {order.gift_message && (
            <span className="text-muted-2 mt-2">
              Gift card: <span className="italic">"{order.gift_message}"</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/shop" className={buttonClass()}>
            Continue shopping
          </Link>
          <a href={waAboutOrder} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'secondary' })}>
            <WhatsAppIcon size={18} />
            Questions? WhatsApp us
          </a>
        </div>
      </>,
    )
  }

  // ---------- still waiting for Paystack ----------
  if (order.payment_status === 'pending' && tries < POLL_TRIES) {
    return wrap(
      <>
        <span className="text-[14px] font-bold text-rose">Order {order.order_number}</span>
        <h1 className="m-0 font-display font-normal text-section">Confirming your payment...</h1>
        <p role="status" className="m-0 text-muted-2 text-[17px]">
          This usually takes a few seconds. If you approved a MoMo prompt on your phone, keep this page open.
        </p>
        <Items order={order} />
      </>,
    )
  }

  // ---------- failed, or never confirmed ----------
  const stillPending = order.payment_status === 'pending'
  return wrap(
    <>
      <span className="text-[14px] font-bold text-rose">Order {order.order_number}</span>
      <h1 className="m-0 font-display font-normal text-section">
        {stillPending ? 'We have not heard from Paystack yet.' : "Payment didn't go through."}
      </h1>
      <p className="m-0 text-muted-2 text-[17px]">
        {stillPending
          ? 'If money left your account, your order is safe and we will confirm it shortly. Otherwise you can try again.'
          : 'No money was taken for this order. You can try again, or order with us on WhatsApp.'}
      </p>
      <Items order={order} />
      {retryMsg && (
        <p role="alert" className="m-0 px-4 py-3 rounded-input bg-danger-bg text-danger font-bold text-[14px]">
          {retryMsg}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={tryAgain} disabled={retrying} className={buttonClass({ variant: 'pay' })}>
          {retrying ? 'Opening Paystack...' : `Try again · ${formatGHS(order.total_ghs)}`}
        </button>
        <a href={waAboutOrder} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'secondary' })}>
          <WhatsAppIcon size={18} />
          Order on WhatsApp
        </a>
      </div>
      {stillPending && (
        <button type="button" onClick={load} className="self-start min-h-11 font-bold underline underline-offset-4 bg-transparent border-0 cursor-pointer">
          Check again
        </button>
      )}
    </>,
  )
}

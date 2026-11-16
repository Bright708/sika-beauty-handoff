import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkoutAvailable, initializeCheckout } from '../lib/api'
import { payWithPaystack } from '../lib/paystack'
import { useBagLines } from '../lib/useBagLines'
import { effectivePrice, tintFor } from '../lib/catalog'
import { formatGHS } from '../lib/format'
import { useBagStore } from '../stores/useBagStore'
import { useCheckoutStore } from '../stores/useCheckoutStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { buttonClass } from '../components/Button'
import ProductImage from '../components/ProductImage'
import { WhatsAppIcon } from '../components/Icons'
import { waLink } from '../config/shop'

const input =
  'w-full min-h-[50px] px-4 font-sans text-[16px] text-ink bg-white border-[1.5px] border-field rounded-input placeholder:text-strike aria-[invalid=true]:border-rose'

function Field({ label, hint, error, optional, children }) {
  const id = useId()
  const errId = `${id}-err`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-bold">
        {label}
        {optional && <span className="font-medium text-muted"> (optional)</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? errId : hint ? `${id}-hint` : undefined })}
      {hint && !error && (
        <span id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={errId} className="text-[13px] font-bold text-rose">
          {error}
        </span>
      )}
    </div>
  )
}

function Section({ n, title, children }) {
  return (
    <section aria-labelledby={`step-${n}`} className="flex flex-col gap-4 pb-8 border-b border-line">
      <h2 id={`step-${n}`} className="m-0 text-[20px] font-extrabold">
        {n}. {title}
      </h2>
      {children}
    </section>
  )
}

// Client-side checks for quick feedback. The server checks everything again.
function validate(f) {
  const e = {}
  if (f.customer_name.trim().length < 2) e.customer_name = 'Please enter your full name.'
  const digits = f.phone.replace(/\D/g, '')
  if (digits.replace(/^233/, '').replace(/^0/, '').length < 9) e.phone = 'Enter a phone number we can WhatsApp, like 024 123 4567.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'Enter your email so Paystack can send your receipt.'
  if (f.fulfilment === 'delivery') {
    if (!f.delivery_zone_id) e.delivery_zone_id = 'Choose your delivery area.'
    if (!f.area.trim()) e.area = 'Tell us the area or a landmark so the rider can find you.'
  }
  if (f.is_gift && f.gift_message.length > 200) e.gift_message = 'Keep the card message under 200 characters.'
  return e
}

export default function Checkout() {
  const navigate = useNavigate()
  const { form, setField, status, setStatus, setLastReference } = useCheckoutStore()
  const settings = useSettingsStore((s) => s.settings)
  const items = useBagStore((s) => s.items)
  const clearBag = useBagStore((s) => s.clear)
  const setQty = useBagStore((s) => s.setQty)
  const { lines, loading, subtotal, hasProblems, refresh } = useBagLines(true)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null) // { tone: 'danger' | 'info', text }
  const [showSummary, setShowSummary] = useState(false)
  const formRef = useRef(null)

  useEffect(() => {
    document.title = 'Checkout · Sika Beauty'
    if (status !== 'idle') setStatus('idle') // a payment window from an earlier visit is gone
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const zones = settings.delivery_zones || []
  const zone = zones.find((z) => String(z.id) === String(form.delivery_zone_id))
  const threshold = settings.free_delivery_threshold_ghs
  const freeDelivery = threshold != null && subtotal >= threshold
  const deliveryFee = form.fulfilment === 'pickup' || freeDelivery ? 0 : zone ? zone.fee_ghs : null
  const total = subtotal + (deliveryFee || 0)
  const busy = status === 'starting' || status === 'paying'

  const set = (key) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setField(key, v)
    if (errors[key]) setErrors(({ [key]: _gone, ...rest }) => rest)
  }

  async function pay(e) {
    e.preventDefault()
    setMessage(null)
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }
    setStatus('starting')
    let started
    try {
      started = await initializeCheckout({
        ...form,
        delivery_zone_id: form.delivery_zone_id ? Number(form.delivery_zone_id) : null,
        items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
      })
    } catch (err) {
      setStatus('idle')
      if (err.errors) {
        setErrors(err.errors)
        requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
      }
      if (err.stock_issues) {
        for (const s of err.stock_issues) setQty(s.variant_id, Math.min(s.available, 10))
        refresh()
      }
      setMessage({ tone: 'danger', text: err.message })
      return
    }

    setLastReference(started.reference)
    setStatus('paying')
    try {
      const result = await payWithPaystack(started.access_code)
      if (result === 'success') {
        clearBag()
        setStatus('done')
        navigate(`/order/${started.reference}`)
      } else {
        setStatus('idle')
        setMessage({ tone: 'info', text: 'Payment cancelled. Your bag is saved.' })
      }
    } catch (err) {
      setStatus('idle')
      setMessage({ tone: 'danger', text: `${err.message} Check your connection and try again.` })
    }
  }

  // ---------- empty / unavailable states ----------
  if (items.length === 0 && status !== 'done') {
    return (
      <section className="container-shop py-20 flex flex-col gap-5 items-start">
        <h1 className="m-0 font-display font-normal text-section">Your bag is empty.</h1>
        <p className="m-0 text-muted">Add something you love, then come back here to pay.</p>
        <Link to="/shop" className={buttonClass()}>
          Shop all
        </Link>
      </section>
    )
  }

  const waText = `Hi ${settings.shop_name}, I'd like to order: ${lines
    .filter((l) => l.variant)
    .map((l) => `${l.variant.product.name} ${l.variant.size_label} x${l.qty}`)
    .join(', ')}`

  const summary = (
    <div className="bg-white rounded-card p-5 sm:p-6 flex flex-col gap-4">
      <h2 className="m-0 text-[18px] font-extrabold">Your order</h2>
      <ul className="m-0 p-0 list-none flex flex-col gap-3.5">
        {lines.map((l, i) =>
          l.variant ? (
            <li key={l.variantId} className="flex gap-3 items-center">
              <ProductImage
                image={l.variant.product.image}
                alt={`${l.variant.product.name}, ${l.variant.size_label}`}
                tint={tintFor(i)}
                sizes="56px"
                placeholder=""
                className="w-14 h-[68px] shrink-0 rounded-[12px]"
              />
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="font-bold truncate">{l.variant.product.name}</span>
                <span className="text-[14px] text-muted">
                  {l.variant.size_label} · Qty {l.qty}
                </span>
                {l.variant.stock <= 0 && <span className="text-[13px] font-bold text-danger">Sold out</span>}
              </div>
              <span className="font-bold whitespace-nowrap">{formatGHS(effectivePrice(l.variant) * l.qty)}</span>
            </li>
          ) : (
            <li key={l.variantId} className="text-muted text-[14px]">
              {l.variant === null ? 'An item is no longer available.' : 'Loading...'}
            </li>
          ),
        )}
      </ul>
      <dl className="m-0 flex flex-col gap-2 pt-3 border-t border-line text-[15px]">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd className="m-0 font-bold">{loading ? '...' : formatGHS(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{form.fulfilment === 'pickup' ? 'Pick up' : 'Delivery'}</dt>
          <dd className="m-0 font-bold">
            {deliveryFee === null ? <span className="text-muted font-medium">Choose your area</span> : deliveryFee === 0 ? 'Free' : formatGHS(deliveryFee)}
          </dd>
        </div>
        <div className="flex justify-between items-baseline pt-2 border-t border-line">
          <dt className="font-extrabold">Total</dt>
          <dd className="m-0 font-extrabold text-[22px]">{formatGHS(total)}</dd>
        </div>
      </dl>
    </div>
  )

  return (
    <div className="container-shop pt-8 pb-20 flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[14px] text-muted flex gap-2">
        <Link to="/shop" className="text-muted">
          Shop
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Checkout</span>
      </nav>
      <h1 className="m-0 font-display font-normal text-section">Checkout</h1>

      {!checkoutAvailable && (
        <p role="status" className="m-0 p-4 rounded-input bg-blush font-bold">
          Paying online is not switched on yet. You can still order on WhatsApp below.
        </p>
      )}

      {/* Phones: summary collapses into a bar */}
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={showSummary}
          aria-controls="mobile-summary"
          onClick={() => setShowSummary((v) => !v)}
          className="w-full min-h-14 px-5 flex items-center justify-between gap-3 bg-white rounded-card border-0 cursor-pointer text-ink text-[15px] font-bold"
        >
          <span>{showSummary ? 'Hide order summary' : 'Show order summary'}</span>
          <span className="font-extrabold">{loading ? '...' : formatGHS(total)}</span>
        </button>
        <div id="mobile-summary" hidden={!showSummary} className="mt-3">
          {summary}
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        <form ref={formRef} onSubmit={pay} noValidate className="flex flex-col gap-8 min-w-0">
          <Section n={1} title="Contact">
            <Field label="Full name" error={errors.customer_name}>
              {(a) => <input {...a} autoComplete="name" value={form.customer_name} onChange={set('customer_name')} className={input} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone (WhatsApp)" error={errors.phone} hint="We'll message you when it's on the way.">
                {(a) => (
                  <input {...a} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} className={input} />
                )}
              </Field>
              <Field label="Email" error={errors.email} hint="For your Paystack receipt.">
                {(a) => (
                  <input {...a} type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} className={input} />
                )}
              </Field>
            </div>
          </Section>

          <Section n={2} title="Delivery">
            <div role="group" aria-label="How do you want it?" className="flex flex-wrap gap-2.5">
              {[
                ['delivery', 'Deliver to me'],
                ['pickup', 'Pick up'],
              ].map(([value, label]) => {
                const on = form.fulfilment === value
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setField('fulfilment', value)}
                    className={`min-h-12 px-6 rounded-full text-[15px] font-bold border-[1.5px] cursor-pointer ${
                      on ? 'bg-ink text-paper border-ink' : 'bg-white text-ink border-chip-line hover:border-ink'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {form.fulfilment === 'delivery' ? (
              <>
                <Field label="Delivery area" error={errors.delivery_zone_id}>
                  {(a) => (
                    <select {...a} value={form.delivery_zone_id} onChange={set('delivery_zone_id')} className={`${input} px-3.5`}>
                      <option value="">Choose your area</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} · {freeDelivery ? 'Free' : formatGHS(z.fee_ghs)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Area or landmark" error={errors.area}>
                  {(a) => (
                    <input {...a} autoComplete="street-address" placeholder="e.g. East Legon, near A&C Mall" value={form.area} onChange={set('area')} className={input} />
                  )}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="GhanaPost GPS address" optional>
                    {(a) => <input {...a} placeholder="e.g. GA-123-4567" value={form.gps_address} onChange={set('gps_address')} maxLength={40} className={input} />}
                  </Field>
                  <Field label="Delivery notes" optional>
                    {(a) => <input {...a} placeholder="Gate colour, best time to call" value={form.notes} onChange={set('notes')} maxLength={500} className={input} />}
                  </Field>
                </div>
              </>
            ) : (
              <div className="p-5 rounded-tile bg-white flex flex-col gap-1">
                <span className="font-bold">Pick up from us</span>
                <span className="text-muted-2">{settings.pickup_address || 'Address shared on WhatsApp after you order.'}</span>
                {settings.pickup_hours && <span className="text-muted-2">{settings.pickup_hours}</span>}
                <span className="text-[14px] text-muted mt-1">We'll WhatsApp you when it's ready.</span>
              </div>
            )}
          </Section>

          <Section n={3} title="Gift">
            <label className="flex items-center gap-3 min-h-11 cursor-pointer font-bold">
              <input type="checkbox" checked={form.is_gift} onChange={set('is_gift')} className="w-5 h-5 accent-ink" />
              This is a gift
            </label>
            {form.is_gift && (
              <Field label="Card message" optional error={errors.gift_message} hint={`${200 - form.gift_message.length} characters left`}>
                {(a) => (
                  <textarea {...a} rows={3} maxLength={200} value={form.gift_message} onChange={set('gift_message')} className={`${input} py-3.5 resize-y`} />
                )}
              </Field>
            )}
          </Section>

          <section aria-labelledby="step-4" className="flex flex-col gap-4">
            <h2 id="step-4" className="m-0 text-[20px] font-extrabold">
              4. Pay
            </h2>
            <dl className="m-0 flex flex-col gap-2 text-[15px] max-w-[440px]">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="m-0 font-bold">{formatGHS(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Delivery</dt>
                <dd className="m-0 font-bold">
                  {deliveryFee === null ? <span className="text-muted font-medium">Choose your area</span> : deliveryFee === 0 ? 'Free' : formatGHS(deliveryFee)}
                </dd>
              </div>
              <div className="flex justify-between items-baseline">
                <dt className="font-extrabold">Total</dt>
                <dd className="m-0 font-extrabold text-[22px]">{formatGHS(total)}</dd>
              </div>
            </dl>

            {message && (
              <p
                role={message.tone === 'danger' ? 'alert' : 'status'}
                className={`m-0 px-4 py-3 rounded-input font-bold text-[14px] max-w-[440px] ${
                  message.tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-blush text-ink'
                }`}
              >
                {message.text}
              </p>
            )}
            {hasProblems && (
              <p className="m-0 text-[14px] font-bold text-danger">
                Something in your bag is sold out. Remove it from your bag to continue.
              </p>
            )}

            <button
              type="submit"
              disabled={busy || loading || hasProblems || !checkoutAvailable}
              className={buttonClass({ variant: 'pay', className: 'w-full max-w-[440px]' })}
            >
              {status === 'starting' ? 'Starting payment...' : status === 'paying' ? 'Finish in the Paystack window' : loading ? 'Pay' : `Pay ${formatGHS(total)}`}
            </button>
            <p className="m-0 text-[14px] text-muted">MoMo or card · Secured by Paystack</p>
            <a
              href={waLink(waText, settings.whatsapp)}
              target="_blank"
              rel="noreferrer"
              className="self-start inline-flex items-center gap-2 min-h-11 font-bold text-ink underline underline-offset-4"
            >
              <WhatsAppIcon size={18} />
              Prefer to order on WhatsApp?
            </a>
          </section>
        </form>

        <aside aria-label="Order summary" className="hidden lg:block sticky top-6">
          {summary}
        </aside>
      </div>
    </div>
  )
}

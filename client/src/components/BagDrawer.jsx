import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useBagStore } from '../stores/useBagStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useBagLines } from '../lib/useBagLines'
import { effectivePrice, isOnSale, tintFor } from '../lib/catalog'
import { formatGHS } from '../lib/format'
import ProductImage from './ProductImage'
import QtyStepper from './QtyStepper'
import { buttonClass } from './Button'
import { CloseIcon } from './Icons'

const MAX_QTY = 10

// Slides in from the right; full screen on phones. Built on <dialog> for focus trapping and Escape.
export default function BagDrawer() {
  const isOpen = useBagStore((s) => s.isOpen)
  const close = useBagStore((s) => s.close)
  const setQty = useBagStore((s) => s.setQty)
  const remove = useBagStore((s) => s.remove)
  const count = useBagStore((s) => s.items.reduce((n, i) => n + i.qty, 0))
  const threshold = useSettingsStore((s) => s.settings.free_delivery_threshold_ghs)
  const { lines, loading, error, subtotal, hasProblems, refresh } = useBagLines(isOpen)
  const ref = useRef(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (isOpen && !d.open) {
      d.showModal()
      refresh()
    }
    if (!isOpen && d.open) d.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const empty = lines.length === 0
  const toFree = threshold != null ? threshold - subtotal : null

  return (
    <dialog
      ref={ref}
      aria-labelledby="bag-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === ref.current) close() // click on the dimmed backdrop
      }}
      className="bag-drawer m-0 ml-auto p-0 h-dvh max-h-dvh w-full sm:w-[440px] max-w-full bg-paper text-ink sm:rounded-l-panel backdrop:bg-ink/40"
    >
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between gap-4 px-5 sm:px-7 pt-5 pb-4 border-b border-line">
          <h2 id="bag-title" className="m-0 font-display font-normal text-[32px] leading-tight">
            Your bag ({count})
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close bag"
            className="w-11 h-11 grid place-items-center rounded-full bg-transparent border-[1.5px] border-line cursor-pointer text-ink hover:border-ink"
          >
            <CloseIcon />
          </button>
        </div>

        {empty ? (
          <div className="flex-1 flex flex-col items-start gap-4 px-5 sm:px-7 py-8">
            <p className="m-0 text-[17px] font-bold">Your bag is empty.</p>
            <p className="m-0 text-muted">Perfumes and body creams, delivered across Accra.</p>
            <Link to="/shop" onClick={close} className={buttonClass({ size: 'md' })}>
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-2">
              {threshold != null && !loading && (
                <p className="mt-3 mb-1 px-4 py-3 rounded-input bg-blush text-[14px] font-bold">
                  {toFree > 0 ? `Add ${formatGHS(toFree)} more for free delivery` : 'You get free delivery'}
                </p>
              )}
              {error && (
                <p role="alert" className="my-3 text-danger font-bold text-[14px]">
                  {error}
                </p>
              )}
              <ul className="m-0 p-0 list-none">
                {lines.map((l, i) => {
                  const v = l.variant
                  if (v === undefined) {
                    return (
                      <li key={l.variantId} className="flex gap-4 py-4 border-b border-line" aria-hidden="true">
                        <div className={`w-[72px] h-[88px] rounded-tile ${tintFor(i)} animate-pulse`} />
                        <div className="flex-1 flex flex-col gap-2 pt-1">
                          <div className="h-4 w-2/3 bg-line rounded" />
                          <div className="h-4 w-1/3 bg-line rounded" />
                        </div>
                      </li>
                    )
                  }
                  const gone = !v || v.stock <= 0
                  const title = v ? v.product.name : 'This item'
                  return (
                    <li key={l.variantId} className="flex gap-4 py-4 border-b border-line">
                      <ProductImage
                        image={v?.product.image}
                        alt={v ? `${v.product.name}, ${v.size_label}` : 'Unavailable item'}
                        tint={tintFor(i)}
                        sizes="72px"
                        placeholder=""
                        className={`w-[72px] h-[88px] shrink-0 rounded-tile ${gone ? 'opacity-60' : ''}`}
                      />
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex justify-between gap-3">
                          <div className="flex flex-col min-w-0">
                            {v ? (
                              <Link
                                to={`/product/${v.product.slug}`}
                                onClick={close}
                                className="font-bold text-ink no-underline hover:underline underline-offset-2"
                              >
                                {title}
                              </Link>
                            ) : (
                              <span className="font-bold">{title}</span>
                            )}
                            {v && <span className="text-[14px] text-muted">{v.size_label}</span>}
                          </div>
                          {v && !gone && (
                            <div className="flex flex-col items-end shrink-0">
                              <span className="font-extrabold">{formatGHS(effectivePrice(v) * l.qty)}</span>
                              {isOnSale(v) && (
                                <s className="text-[13px] text-strike">
                                  <span className="sr-only">Was </span>
                                  {formatGHS(v.price_ghs * l.qty)}
                                </s>
                              )}
                            </div>
                          )}
                        </div>
                        {gone ? (
                          <p className="m-0 text-[14px] font-bold text-danger">
                            {v ? 'Sold out' : 'No longer available'}
                          </p>
                        ) : (
                          v.stock <= 3 && <p className="m-0 text-[13px] font-bold text-rose">Only {v.stock} left</p>
                        )}
                        <div className="flex items-center justify-between gap-3 mt-auto">
                          {!gone ? (
                            <QtyStepper
                              size="sm"
                              label={`Quantity of ${title}`}
                              value={l.qty}
                              max={Math.min(v.stock, MAX_QTY)}
                              onChange={(n) => setQty(l.variantId, n)}
                            />
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            onClick={() => remove(l.variantId)}
                            aria-label={`Remove ${title}${v ? ` ${v.size_label}` : ''}`}
                            className="min-h-11 px-1 bg-transparent border-0 text-[14px] font-bold text-muted underline underline-offset-4 cursor-pointer hover:text-ink"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="px-5 sm:px-7 pt-4 pb-[calc(20px+env(safe-area-inset-bottom))] border-t border-line flex flex-col gap-3 bg-paper">
              <div className="flex justify-between items-baseline">
                <span className="font-bold">Subtotal</span>
                <span className="font-extrabold text-[20px]">{loading ? '...' : formatGHS(subtotal)}</span>
              </div>
              <p className="m-0 -mt-2 text-[14px] text-muted">Delivery calculated at checkout</p>
              {hasProblems && (
                <p className="m-0 text-[14px] font-bold text-danger">Remove the sold out items to check out.</p>
              )}
              {hasProblems || loading ? (
                <button type="button" disabled className={buttonClass({ className: 'w-full' })}>
                  Checkout
                </button>
              ) : (
                <Link to="/checkout" onClick={close} className={buttonClass({ className: 'w-full' })}>
                  Checkout
                </Link>
              )}
              <button type="button" onClick={close} className={buttonClass({ variant: 'secondary', className: 'w-full' })}>
                Continue shopping
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}

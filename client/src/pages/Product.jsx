import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import ProductImage from '../components/ProductImage'
import QtyStepper from '../components/QtyStepper'
import { CheckIcon, PlusIcon, WhatsAppIcon } from '../components/Icons'
import { getProduct, getProducts } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import {
  COLLECTIONS,
  TINTS,
  defaultVariant,
  effectivePrice,
  isBodyCare,
  isOnSale,
  isPerfume,
  lowStock,
  tintFor,
} from '../lib/catalog'
import { formatGHS } from '../lib/format'
import { useAddToBag } from '../lib/useAddToBag'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useBagStore } from '../stores/useBagStore'
import { SHOP, waLink } from '../config/shop'

const HOW_TO_WEAR = {
  perfume: 'Apply body cream first. Spray on wrists, neck and behind the ears. Do not rub.',
  'body-cream': 'Smooth onto clean, slightly damp skin after your bath. Follow with your perfume so the scent lasts longer.',
  'body-butter': 'Warm a little between your hands and smooth onto damp skin after your bath. Follow with your perfume.',
  'body-oil': 'Massage a few drops into damp skin after your shower. A little goes a long way.',
  'body-mist': 'Mist over skin and clothes from arm’s length. Reapply during the day as you like.',
  'gift-set': 'Use the cream first, then the perfume on top. Everything comes sealed in the box.',
}

// Breadcrumb parent for each category
const PARENT = (slug) =>
  slug === 'perfume'
    ? { to: '/shop/perfume', label: 'Perfumes' }
    : slug === 'gift-set'
      ? { to: '/shop/gift-set', label: 'Gift sets' }
      : { to: '/shop/body-creams', label: 'Body creams' }

export default function Product() {
  const { slug } = useParams()
  const { data: product, loading, error } = useAsync(() => getProduct(slug), [slug])

  useEffect(() => {
    if (product) document.title = `${product.name} ${product.category.name.toLowerCase()} · ${SHOP.name}`
  }, [product])

  if (loading) return <ProductSkeleton />
  if (error || !product) {
    return (
      <section className="container-shop py-24 flex flex-col gap-6 items-start">
        <h1 className="m-0 font-display font-normal text-section">
          {error?.status === 404 ? 'This product is no longer available.' : 'We could not load this product.'}
        </h1>
        <p className="m-0 text-muted">
          {error?.status === 404 ? 'It may have sold out or been removed.' : 'Check your connection and refresh the page.'}
        </p>
        <Button to="/shop">Shop all</Button>
      </section>
    )
  }
  return <ProductView key={product.id} product={product} />
}

function ProductView({ product }) {
  const settings = useSettingsStore((s) => s.settings)
  const addToBag = useAddToBag()
  const [variant, setVariant] = useState(() => defaultVariant(product))
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const price = effectivePrice(variant)
  const sale = isOnSale(variant)
  const soldOut = variant.stock <= 0
  const maxQty = Math.max(1, Math.min(variant.stock, 10))
  const parent = PARENT(product.category.slug)

  const pick = (v) => {
    setVariant(v)
    setQty(1)
    setAdded(false)
  }

  const add = () => {
    addToBag(variant, qty, { toast: false })
    setAdded(true)
  }

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
  const waText = `Hi ${settings.shop_name}, I'd like to order ${product.name} ${variant.size_label} (x${qty}, ${formatGHS(price * qty)}). ${pageUrl}`

  const panels = []
  if (isPerfume(product) && (product.notes_top || product.notes_heart || product.notes_base)) {
    panels.push({
      id: 'notes',
      title: 'Scent notes',
      body: [
        product.notes_top && `Top: ${product.notes_top}`,
        product.notes_heart && `Heart: ${product.notes_heart}`,
        product.notes_base && `Base: ${product.notes_base}`,
      ]
        .filter(Boolean)
        .join('\n'),
    })
  }
  panels.push({ id: 'use', title: 'How to wear it', body: HOW_TO_WEAR[product.category.slug] || HOW_TO_WEAR['body-cream'] })
  const zones = settings.delivery_zones || []
  panels.push({
    id: 'delivery',
    title: 'Delivery and returns',
    body: [
      zones.length
        ? `Delivery fees:\n${zones.map((z) => `${z.name} · ${formatGHS(z.fee_ghs)}`).join('\n')}`
        : 'Delivery fees are shown at checkout.',
      settings.pickup_address ? `Or pick up free from ${settings.pickup_address} (${settings.pickup_hours}).` : '',
      `Unopened, sealed items can be returned within ${SHOP.returnsDays} days.`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  })

  return (
    <>
      <div className="container-shop pt-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-[14px] text-muted">
          <Link to="/" className="text-muted underline-offset-2 hover:underline">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to={parent.to} className="text-muted underline-offset-2 hover:underline">{parent.label}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-ink font-semibold">{product.name}</span>
        </nav>
      </div>

      <section className="container-shop pt-6 flex flex-wrap gap-14 items-start">
        <Gallery product={product} saveAmount={sale ? variant.price_ghs - variant.sale_price_ghs : 0} />

        <div className="flex-[1_1_440px] min-w-0 flex flex-col gap-[26px]">
          <div className="flex flex-col gap-2.5">
            <span className="text-[14px] font-bold text-rose">
              {[product.category.name, product.brand].filter(Boolean).join(' · ')}
            </span>
            <h1 className="m-0 font-display font-normal text-[clamp(44px,4.6vw,68px)] leading-none tracking-[-0.02em]">
              {product.name}
            </h1>
            {product.description && (
              <p className="m-0 text-[18px] text-muted-2 max-w-[44ch]">{product.description}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-3.5">
              <span className="font-display text-[40px] leading-none">{formatGHS(price)}</span>
              {sale && (
                <s className="text-[18px] text-strike">
                  <span className="sr-only">Was </span>
                  {formatGHS(variant.price_ghs)}
                </s>
              )}
            </div>
            {lowStock(variant) && (
              <p className="m-0 text-[14px] font-bold text-rose">Only {variant.stock} left</p>
            )}
            {soldOut && <p className="m-0 text-[14px] font-bold text-danger">This size is sold out</p>}
          </div>

          {product.variants.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span id="size-label" className="text-[14px] font-extrabold">Size</span>
              <div role="group" aria-labelledby="size-label" className="flex flex-wrap gap-2.5">
                {product.variants.map((v) => {
                  const on = v.id === variant.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pick(v)}
                      className={`min-h-14 min-w-[132px] px-5 py-2 cursor-pointer flex flex-col items-start rounded-tile border-[1.5px] transition-colors duration-150 ${
                        on ? 'bg-ink text-paper border-ink' : 'bg-white text-ink border-chip-line hover:border-ink'
                      }`}
                    >
                      <span className="font-extrabold">{v.size_label}</span>
                      <span className={`text-[13px] ${on ? 'text-on-ink-muted' : 'text-muted'}`}>
                        {v.stock <= 0 ? 'Sold out' : formatGHS(effectivePrice(v))}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <QtyStepper value={qty} max={maxQty} disabled={soldOut} onChange={(n) => { setQty(n); setAdded(false) }} />
            <button
              type="button"
              onClick={add}
              disabled={soldOut}
              className="flex-[1_1_220px] min-h-14 cursor-pointer text-[16px] font-extrabold text-paper bg-ink rounded-full transition-colors duration-150 hover:bg-ink-2 disabled:cursor-not-allowed disabled:bg-field disabled:text-muted"
            >
              {soldOut ? 'Sold out' : `Add to bag · ${formatGHS(price * qty)}`}
            </button>
          </div>
          {added && (
            <p role="status" className="-mt-3 m-0 flex items-center gap-2 text-[14px] font-bold text-success">
              <CheckIcon />
              Added to your bag.
              <button
                type="button"
                onClick={() => useBagStore.getState().open()}
                className="min-h-11 px-1 underline underline-offset-4 cursor-pointer text-ink"
              >
                View bag
              </button>
            </p>
          )}

          <a
            href={waLink(waText, settings.whatsapp)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2.5 min-h-14 border-[1.5px] border-ink text-ink no-underline font-extrabold rounded-full transition-colors duration-150 hover:bg-ink hover:text-paper"
          >
            <WhatsAppIcon />
            Order on WhatsApp instead
          </a>

          <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))]">
            <div className="p-4 bg-white rounded-tile flex flex-col gap-0.5">
              <span className="font-extrabold text-[14px]">Delivery in Accra</span>
              <span className="text-[14px] text-muted">Today if you order before {settings.cutoff_time}</span>
            </div>
            <div className="p-4 bg-white rounded-tile flex flex-col gap-0.5">
              <span className="font-extrabold text-[14px]">Pay your way</span>
              <span className="text-[14px] text-muted">MoMo or card, secured by Paystack</span>
            </div>
          </div>

          <Accordion panels={panels} />
        </div>
      </section>

      <Related product={product} />
    </>
  )
}


function Gallery({ product, saveAmount }) {
  const images = product.images || []
  // Without photos yet, show one tinted placeholder.
  const slides = images.length ? images : [null]
  const [active, setActive] = useState(0)
  const track = useRef(null)

  const go = (i) => {
    setActive(i)
    const el = track.current
    if (el) el.scrollTo({ left: el.clientWidth * i, behavior: 'smooth' })
  }

  // Keep thumbnails in sync when swiping on a phone
  const onScroll = () => {
    const el = track.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== active) setActive(i)
  }

  return (
    <div className="flex-[1_1_520px] min-w-0 flex flex-col gap-3.5">
      <div className="relative">
        <div
          ref={track}
          onScroll={onScroll}
          className="flex overflow-x-auto snap-x snap-mandatory rounded-panel [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Product photos"
          role="region"
          tabIndex={slides.length > 1 ? 0 : undefined}
        >
          {slides.map((img, i) => (
            <ProductImage
              key={img?.storage_path || i}
              image={img}
              alt={`${product.name}, photo ${i + 1} of ${slides.length}`}
              tint={TINTS[i % TINTS.length]}
              eager={i === 0}
              sizes="(max-width: 1100px) 100vw, 55vw"
              placeholder="Product photo"
              className="aspect-square w-full shrink-0 snap-center"
            />
          ))}
        </div>
        {saveAmount > 0 && (
          <span className="absolute top-[18px] left-[18px] px-3.5 py-[7px] bg-rose text-white text-[13px] font-extrabold rounded-full">
            Save {formatGHS(saveAmount)}
          </span>
        )}
      </div>
      {slides.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {slides.map((img, i) => (
            <button
              key={img?.storage_path || i}
              type="button"
              aria-label={`Show photo ${i + 1}`}
              aria-pressed={active === i}
              onClick={() => go(i)}
              className={`aspect-square cursor-pointer rounded-tile overflow-hidden border-2 p-0 ${
                active === i ? 'border-ink' : 'border-transparent'
              }`}
            >
              <ProductImage image={img} alt="" tint={TINTS[i % TINTS.length]} sizes="120px" placeholder="" className="w-full h-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Accordion({ panels }) {
  const [open, setOpen] = useState(panels[0]?.id)
  return (
    <div className="flex flex-col border-t border-line">
      {panels.map((p) => {
        const isOpen = open === p.id
        return (
          <div key={p.id} className="border-b border-line">
            <h2 className="m-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`panel-${p.id}`}
                onClick={() => setOpen(isOpen ? '' : p.id)}
                className="w-full min-h-[60px] flex justify-between items-center cursor-pointer bg-transparent border-0 p-0 text-[16px] font-extrabold text-ink text-left"
              >
                {p.title}
                <span aria-hidden="true" className="text-[22px] font-normal">{isOpen ? '−' : '+'}</span>
              </button>
            </h2>
            <div id={`panel-${p.id}`} hidden={!isOpen}>
              <p className="m-0 mb-5 text-muted-2 whitespace-pre-line">{p.body}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// "Make it last longer": perfumes pair with body care and vice versa.
function Related({ product }) {
  const addToBag = useAddToBag()
  const category = isPerfume(product)
    ? COLLECTIONS['body-creams'].categories.join(',')
    : isBodyCare(product)
      ? 'perfume'
      : undefined
  const { data } = useAsync(
    () => getProducts({ category, in_stock: 1, sort: 'best', limit: 3, exclude: product.slug }),
    [product.slug],
  )
  const items = data?.products || []
  if (!items.length) return null

  return (
    <section aria-labelledby="pair-h" className="container-shop py-24 flex flex-col gap-7">
      <h2 id="pair-h" className="m-0 font-display font-normal text-[clamp(32px,3.4vw,48px)] leading-[1.05]">
        Make it last longer
      </h2>
      <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))]">
        {items.map((p, i) => {
          const v = defaultVariant(p)
          const title = `${p.name}, ${v.size_label}`
          return (
            <article key={p.id} className="flex gap-4 items-center p-3.5 bg-white rounded-card">
              <Link to={`/product/${p.slug}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
                <ProductImage image={p.images?.[0]} alt={title} tint={tintFor(i + 1)} placeholder="" sizes="96px" className="w-24 h-28 rounded-tile" />
              </Link>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[13px] text-muted">{p.category.name}</span>
                <Link to={`/product/${p.slug}`} className="font-bold text-ink no-underline hover:underline underline-offset-2">
                  {title}
                </Link>
                <span className="font-extrabold">{formatGHS(effectivePrice(v))}</span>
              </div>
              <button
                type="button"
                aria-label={`Add ${p.name} ${p.category.name.toLowerCase()} to bag`}
                onClick={() => addToBag(v)}
                className="shrink-0 w-11 h-11 flex items-center justify-center cursor-pointer rounded-full bg-ink text-paper hover:bg-ink-2 transition-colors duration-150"
              >
                <PlusIcon />
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ProductSkeleton() {
  return (
    <section className="container-shop pt-[72px] pb-24 flex flex-wrap gap-14" aria-busy="true" aria-label="Loading product">
      <div className="flex-[1_1_520px] aspect-square rounded-panel bg-peach animate-pulse" />
      <div className="flex-[1_1_440px] flex flex-col gap-5">
        <div className="h-4 w-32 rounded-full bg-line" />
        <div className="h-16 w-2/3 rounded-full bg-line" />
        <div className="h-5 w-full rounded-full bg-line" />
        <div className="h-10 w-40 rounded-full bg-line" />
        <div className="h-14 w-full rounded-full bg-line" />
      </div>
    </section>
  )
}

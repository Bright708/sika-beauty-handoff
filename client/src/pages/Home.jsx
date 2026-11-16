import { useState } from 'react'
import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import Button from '../components/Button'
import Chip from '../components/Chip'
import ProductGrid, { ProductGridSkeleton } from '../components/ProductGrid'
import { DeliveryIcon, PhoneIcon, ShieldIcon } from '../components/Icons'
import { getProducts } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { COLLECTIONS } from '../lib/catalog'
import { REVIEWS, waLink } from '../config/shop'
import { useSettingsStore } from '../stores/useSettingsStore'

const h2 = 'm-0 font-display font-normal text-section'

const TILES = [
  { to: '/shop/perfume', label: 'Perfumes', cls: 'bg-sand text-ink' },
  { to: '/shop/body-creams', label: 'Body creams', cls: 'bg-sage text-ink' },
  { to: '/shop/body-mist', label: 'Body mists', cls: 'bg-lilac text-ink' },
  { to: '/shop/gift-set', label: 'Gift sets', cls: 'bg-ink text-paper' },
]

const TABS = [
  { label: 'All', category: undefined },
  { label: 'Perfumes', category: 'perfume' },
  { label: 'Body creams', category: COLLECTIONS['body-creams'].categories.join(',') },
]

export default function Home() {
  return (
    <>
      <Hero />
      <CategoryTiles />
      <Trending />
      <Promos />
      <BestSellers />
      <Reviews />
      <Reasons />
      <Newsletter />
    </>
  )
}

function CategoryTiles() {
  return (
    <section aria-label="Shop by category" className="container-shop pt-5">
      <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))]">
        {TILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={`flex justify-between items-center gap-3 min-h-24 px-7 rounded-admin no-underline ${t.cls}`}
          >
            <span className="font-display text-[26px] leading-tight">{t.label}</span>
            <span aria-hidden="true" className="text-[22px]">→</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function Trending() {
  const [tab, setTab] = useState(0)
  const { data, loading, error } = useAsync(
    () => getProducts({ category: TABS[tab].category, sort: 'newest', limit: 8 }),
    [tab],
  )
  return (
    <section id="shop" aria-labelledby="trending-h" className="container-shop pt-24 flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <h2 id="trending-h" className={h2}>Trending now</h2>
        <div role="group" aria-label="Filter products" className="flex flex-wrap gap-2">
          {TABS.map((t, i) => (
            <Chip key={t.label} active={tab === i} onClick={() => setTab(i)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>
      {error ? (
        <p className="text-muted">We could not load products right now. Please refresh the page.</p>
      ) : loading && !data ? (
        <ProductGridSkeleton count={8} />
      ) : (
        <ProductGrid products={data.products} />
      )}
    </section>
  )
}

function Promos() {
  return (
    <section id="gifts" className="container-shop pt-24">
      <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))]">
        <div className="bg-ink text-paper rounded-panel p-[clamp(32px,4vw,56px)] min-h-[420px] flex flex-col justify-between gap-8">
          <span className="self-start px-4 py-2 bg-ink-2 rounded-full text-[13px] font-bold text-rose-light">Gift sets</span>
          <div className="flex flex-col gap-4">
            <h2 className="m-0 font-display font-normal text-[clamp(36px,3.6vw,52px)] leading-[1.05]">
              Wrapped, ready, and on time for December.
            </h2>
            <p className="m-0 max-w-[38ch] text-on-ink-muted">
              A perfume and matching body cream in a gift box. Add a card message at checkout.
            </p>
          </div>
          <Button to="/shop/gift-set" variant="light" className="self-start">Shop gift sets</Button>
        </div>
        <div className="bg-sage rounded-panel p-[clamp(32px,4vw,56px)] min-h-[420px] flex flex-col justify-between gap-8">
          <span className="self-start px-4 py-2 bg-paper rounded-full text-[13px] font-bold">The routine</span>
          <div className="flex flex-col gap-4">
            <h2 className="m-0 font-display font-normal text-[clamp(36px,3.6vw,52px)] leading-[1.05]">
              Cream first, then perfume. It lasts twice as long.
            </h2>
            <p className="m-0 max-w-[38ch] text-on-sage">
              Scent holds best on moisturised skin. Pair any perfume with its body cream.
            </p>
          </div>
          <Button to="/shop/body-creams" className="self-start">Shop body creams</Button>
        </div>
      </div>
    </section>
  )
}

function BestSellers() {
  const { data, loading, error } = useAsync(() => getProducts({ sort: 'best', limit: 4 }), [])
  if (error) return null
  return (
    <section aria-labelledby="best-h" className="container-shop pt-24 flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <h2 id="best-h" className={h2}>Best sellers</h2>
        <Link to="/shop" className="font-bold text-ink underline underline-offset-4 min-h-11 inline-flex items-center">
          See all products
        </Link>
      </div>
      {loading && !data ? <ProductGridSkeleton count={4} /> : <ProductGrid products={data.products} />}
    </section>
  )
}

function Reviews() {
  if (!REVIEWS.length) return null
  return (
    <section aria-labelledby="rev-h" className="container-shop pt-24 flex flex-col gap-8">
      <h2 id="rev-h" className={h2}>What customers say</h2>
      <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))]">
        {REVIEWS.map((r, i) => (
          <figure key={i} className="m-0 p-8 bg-white rounded-card flex flex-col gap-[18px]">
            <span role="img" aria-label={`${r.stars} out of 5 stars`} className="text-rose tracking-[3px]">
              {'★'.repeat(r.stars)}
            </span>
            <blockquote className="m-0 text-[18px] leading-normal">{r.quote}</blockquote>
            <figcaption className="text-[14px] font-bold">
              {r.name}, {r.area}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

function Reasons() {
  const cutoff = useSettingsStore((s) => s.settings.cutoff_time)
  const items = [
    { Icon: DeliveryIcon, title: 'Same-day delivery', body: `Order before ${cutoff} for delivery anywhere in Accra today.` },
    { Icon: PhoneIcon, title: 'Pay with MoMo', body: 'MTN MoMo, Telecel Cash, AirtelTigo Money or card, through Paystack.' },
    { Icon: ShieldIcon, title: 'Authentic only', body: 'Every bottle arrives sealed. Not happy? Message us within 24 hours.' },
  ]
  return (
    <section id="story" aria-label="Why shop with us" className="container-shop pt-24 scroll-mt-6">
      <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))]">
        {items.map(({ Icon, title, body }) => (
          <div key={title} className="p-7 border-[1.5px] border-line rounded-card flex flex-col gap-2">
            <span className="text-rose"><Icon /></span>
            <span className="font-extrabold text-[18px]">{title}</span>
            <span className="text-muted">{body}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// There is no mailing list backend yet, so "Subscribe" opens WhatsApp with the request
// pre-filled. The owner adds the number/email to her broadcast list.
function Newsletter() {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const whatsapp = useSettingsStore((s) => s.settings.whatsapp)

  const submit = (e) => {
    e.preventDefault()
    if (value.trim().length < 6) {
      setError('Enter your WhatsApp number or email.')
      return
    }
    setError('')
    window.open(waLink(`Hi, please add me to your new arrivals list: ${value.trim()}`, whatsapp), '_blank', 'noopener')
  }

  return (
    <section id="visit" className="container-shop py-24">
      <div className="bg-blush rounded-panel p-[clamp(32px,5vw,72px)] flex flex-wrap items-center justify-between gap-8">
        <div className="flex-[1_1_420px] flex flex-col gap-3">
          <h2 className={h2}>First to know about new scents.</h2>
          <p className="m-0 text-muted-2">New arrivals and restocks, once a week. No spam.</p>
        </div>
        <form onSubmit={submit} noValidate className="flex-[1_1_420px] flex flex-wrap gap-2.5">
          <label className="flex-[1_1_240px] flex flex-col gap-1.5 text-[13px] font-bold">
            WhatsApp number or email
            <input
              type="text"
              inputMode="email"
              autoComplete="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="+233 24 000 0000"
              aria-invalid={!!error}
              aria-describedby={error ? 'news-err' : undefined}
              className="min-h-[54px] px-[22px] text-[16px] font-normal text-ink bg-white border-[1.5px] border-ink rounded-full"
            />
          </label>
          <button
            type="submit"
            className="self-end min-h-[54px] px-[30px] cursor-pointer text-[15px] font-bold text-paper bg-ink rounded-full hover:bg-ink-2 transition-colors duration-150"
          >
            Subscribe
          </button>
          {error && (
            <p id="news-err" role="alert" className="basis-full m-0 text-[14px] font-semibold text-danger">
              {error}
            </p>
          )}
        </form>
      </div>
    </section>
  )
}

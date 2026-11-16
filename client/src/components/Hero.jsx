import { Link } from 'react-router-dom'
import Button from './Button'
import { ArrowIcon } from './Icons'
import { formatGHS } from '../lib/format'

// Featured product on the floating chip. Becomes data-driven once products come from the API.
const featured = { name: 'Oud Noir, 100ml', price: 850, slug: 'oud-noir' }

// Set this to a real photo URL (e.g. '/hero.webp') when the owner has one.
// It is preloaded in index.html; update the <link rel="preload"> there to match.
const HERO_PHOTO = null

export default function Hero() {
  return (
    <section id="top" className="container-shop pt-8">
      <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))]">
        {/* Text panel */}
        <div className="bg-blush rounded-panel p-[clamp(32px,5vw,72px)] flex flex-col justify-center gap-6 lg:min-h-[560px]">
          <span className="self-start px-4 py-2 bg-paper rounded-full text-[13px] font-bold">
            New in for December
          </span>
          <h1 className="m-0 font-display font-normal text-hero text-balance">
            Smell like you meant it.
          </h1>
          <p className="m-0 max-w-[34ch] text-[18px] text-muted-2">
            Long-lasting perfumes and rich body creams, delivered to your door in Accra the same day.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button to="/shop/perfume">Shop perfumes</Button>
            <Button to="/shop/body-creams" variant="secondary">
              Shop body creams
            </Button>
          </div>
        </div>

        {/* Photo panel with floating product chip */}
        <div className="relative bg-peach rounded-panel min-h-[420px] lg:min-h-[560px] flex flex-wrap items-end justify-between gap-4 p-7 overflow-hidden">
          {HERO_PHOTO ? (
            <img
              src={HERO_PHOTO}
              alt="Perfume bottle and body butter jar on a warm backdrop"
              fetchPriority="high"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <span
              role="img"
              aria-label="Photo placeholder: perfume bottle and body butter jar on a warm backdrop"
              className="relative text-[12px] font-bold tracking-[0.14em] uppercase text-placeholder"
            >
              Hero photo
            </span>
          )}

          <div className="relative bg-paper rounded-[18px] py-3.5 px-4 flex items-center gap-3.5 shadow-float">
            <div aria-hidden="true" className="w-[52px] h-[52px] rounded-input bg-ink shrink-0" />
            <div className="flex flex-col">
              <span className="font-bold text-[15px]">{featured.name}</span>
              <span className="text-[14px] text-muted">{formatGHS(featured.price)}</span>
            </div>
            <Link
              to={`/product/${featured.slug}`}
              aria-label="View Oud Noir"
              className="w-11 h-11 flex items-center justify-center rounded-full bg-rose text-white shrink-0 hover:bg-danger transition-colors duration-150"
            >
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

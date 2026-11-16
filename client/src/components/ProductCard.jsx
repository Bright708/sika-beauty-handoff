import { Link } from 'react-router-dom'
import ProductImage from './ProductImage'
import { defaultVariant, effectivePrice, inStock, isOnSale, percentOff, tintFor } from '../lib/catalog'
import { formatGHS } from '../lib/format'
import { useAddToBag } from '../lib/useAddToBag'

export default function ProductCard({ product, index = 0, eager = false }) {
  const addToBag = useAddToBag()
  const v = defaultVariant(product)
  const soldOut = !inStock(product)
  const sale = isOnSale(v)
  const title = `${product.name}, ${v.size_label}`
  const href = `/product/${product.slug}`

  return (
    <article className="flex flex-col gap-3.5">
      <Link to={href} aria-label={title} tabIndex={-1} className="relative block rounded-card overflow-hidden">
        <ProductImage
          image={product.images?.[0]}
          alt={title}
          tint={tintFor(index)}
          eager={eager}
          className={`aspect-[4/5] rounded-card ${soldOut ? 'opacity-60' : ''}`}
        />
        {sale && !soldOut && (
          <span className="absolute top-3.5 left-3.5 px-3 py-1.5 bg-rose text-white text-[12px] font-extrabold rounded-full">
            -{percentOff(v)}%
          </span>
        )}
      </Link>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-muted">{product.category.name}</span>
        <Link to={href} className="inline-block py-2.5 -my-2.5 font-bold text-[17px] text-ink no-underline hover:underline underline-offset-2">
          {title}
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="font-extrabold text-[17px]">{formatGHS(effectivePrice(v))}</span>
          {sale && (
            <s className="text-[14px] text-strike">
              <span className="sr-only">Was </span>
              {formatGHS(v.price_ghs)}
            </s>
          )}
        </div>
      </div>
      <button
        type="button"
        disabled={soldOut}
        onClick={() => addToBag(v)}
        aria-label={soldOut ? `${title} is sold out` : `Add ${title} to bag`}
        className="mt-auto min-h-12 cursor-pointer text-[14px] font-bold text-ink bg-white border-[1.5px] border-ink rounded-full transition-colors duration-150 hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:bg-transparent disabled:text-muted disabled:border-field disabled:hover:bg-transparent disabled:hover:text-muted"
      >
        {soldOut ? 'Sold out' : 'Add to bag'}
      </button>
    </article>
  )
}

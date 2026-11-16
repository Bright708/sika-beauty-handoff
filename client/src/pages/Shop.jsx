import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Chip, { ChipLink } from '../components/Chip'
import Button from '../components/Button'
import ProductGrid, { ProductGridSkeleton } from '../components/ProductGrid'
import { getProducts } from '../lib/api'
import { COLLECTIONS } from '../lib/catalog'
// Categories are fixed (seeded by the migration), so the client keeps the same list.
import { categories as CATEGORY_LIST } from '../data/seed'

const PAGE_SIZE = 12

// Top-level chips. "Body creams" is a collection of all body categories.
const TOP = [
  { slug: '', label: 'All' },
  { slug: 'perfume', label: 'Perfumes' },
  { slug: 'body-creams', label: 'Body creams' },
  { slug: 'gift-set', label: 'Gift sets' },
]
const BODY = COLLECTIONS['body-creams']

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price low to high' },
  { value: 'price_desc', label: 'Price high to low' },
]

function resolve(slug) {
  if (!slug) return { title: 'Shop all', filter: undefined }
  if (COLLECTIONS[slug]) return { title: COLLECTIONS[slug].name, filter: COLLECTIONS[slug].categories.join(',') }
  const top = TOP.find((t) => t.slug === slug)
  const cat = CATEGORY_LIST.find((c) => c.slug === slug)
  if (!cat) return null
  return { title: top ? top.label : cat.name, filter: slug }
}

export default function Shop() {
  const { category = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const onSale = params.get('on_sale') === '1'
  const inStockOnly = params.get('in_stock') === '1'
  const sort = params.get('sort') || 'newest'
  const info = resolve(category)

  const [state, setState] = useState({ products: [], total: 0, page: 1, hasMore: false, loading: true, error: false })

  const load = async (page, append) => {
    setState((s) => ({ ...s, loading: true, error: false }))
    try {
      const res = await getProducts({
        category: info.filter,
        on_sale: onSale ? 1 : undefined,
        in_stock: inStockOnly ? 1 : undefined,
        sort,
        page,
        limit: PAGE_SIZE,
      })
      setState((s) => ({
        products: append ? [...s.products, ...res.products] : res.products,
        total: res.total,
        page,
        hasMore: res.has_more,
        loading: false,
        error: false,
      }))
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }))
    }
  }

  useEffect(() => {
    if (info) load(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, onSale, inStockOnly, sort])

  useEffect(() => {
    document.title = `${info ? info.title : 'Not found'} · Sika Beauty`
  }, [info?.title])

  if (!info) {
    return (
      <section className="container-shop py-24 flex flex-col gap-6 items-start">
        <h1 className="m-0 font-display font-normal text-section">We could not find that page.</h1>
        <p className="m-0 text-muted">The category may have moved. Have a look at everything instead.</p>
        <Button to="/shop">Shop all</Button>
      </section>
    )
  }

  const setFlag = (key, on) => {
    const next = new URLSearchParams(params)
    if (on) next.set(key, '1')
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const setSort = (value) => {
    const next = new URLSearchParams(params)
    if (value === 'newest') next.delete('sort')
    else next.set('sort', value)
    setParams(next, { replace: true })
  }
  const qs = params.toString() ? `?${params}` : ''
  const inBody = category === 'body-creams' || BODY.categories.includes(category)
  const topActive = inBody ? 'body-creams' : category

  return (
    <section className="container-shop pt-10 pb-24 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display font-normal text-section">{info.title}</h1>
        <p className="m-0 text-muted font-semibold text-[15px]" aria-live="polite">
          {state.loading && !state.products.length
            ? 'Loading products'
            : `${state.total} ${state.total === 1 ? 'product' : 'products'}`}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <nav aria-label="Categories" className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:flex-wrap">
          {TOP.map((t) => (
            <ChipLink key={t.slug} to={`/shop${t.slug ? `/${t.slug}` : ''}${qs}`} active={topActive === t.slug}>
              {t.label}
            </ChipLink>
          ))}
        </nav>
        {inBody && (
          <nav aria-label="Body care types" className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:flex-wrap">
            <ChipLink to={`/shop/body-creams${qs}`} active={category === 'body-creams'}>All body care</ChipLink>
            {BODY.categories.map((slug) => (
              <ChipLink key={slug} to={`/shop/${slug}${qs}`} active={category === slug}>
                {CATEGORY_LIST.find((c) => c.slug === slug).name}
              </ChipLink>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Filters" className="flex flex-wrap gap-2">
            <Chip active={onSale} onClick={() => setFlag('on_sale', !onSale)}>On sale</Chip>
            <Chip active={inStockOnly} onClick={() => setFlag('in_stock', !inStockOnly)}>In stock</Chip>
          </div>
          <label className="flex items-center gap-2 text-[14px] font-bold">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="min-h-11 pl-4 pr-10 text-[16px] font-semibold text-ink bg-white border-[1.5px] border-field rounded-full cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 viewBox=%220 0 12 8%22><path d=%22M1 1l5 5 5-5%22 fill=%22none%22 stroke=%22%2324150F%22 stroke-width=%221.8%22/></svg>')] bg-no-repeat bg-[right_16px_center]"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {state.error && !state.products.length ? (
        <div className="flex flex-col gap-4 items-start">
          <p className="m-0 text-muted">We could not load products right now.</p>
          <Button variant="secondary" size="md" onClick={() => load(1, false)}>Try again</Button>
        </div>
      ) : state.loading && !state.products.length ? (
        <ProductGridSkeleton count={8} />
      ) : state.products.length === 0 ? (
        <div className="bg-white rounded-card p-8 flex flex-col gap-4 items-start">
          <p className="m-0 font-extrabold text-[18px]">Nothing here yet.</p>
          <p className="m-0 text-muted">
            {onSale || inStockOnly ? 'Try removing a filter.' : 'New stock is on the way. Have a look at the rest of the shop.'}
          </p>
          <Button to="/shop" variant="secondary" size="md">Shop all</Button>
        </div>
      ) : (
        <>
          <ProductGrid products={state.products} eagerCount={4} />
          {state.hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="secondary" disabled={state.loading} onClick={() => load(state.page + 1, true)}>
                {state.loading ? 'Loading' : 'Load more'}
              </Button>
            </div>
          )}
          {state.error && <p role="alert" className="text-center text-danger">That did not load. Please try again.</p>}
        </>
      )}
    </section>
  )
}

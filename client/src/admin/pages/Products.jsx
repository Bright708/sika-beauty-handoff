import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ImportPanel from '../ImportPanel'
import { adminFetch } from '../../lib/adminApi'
import { effectivePrice, tintFor } from '../../lib/catalog'
import { formatGHS } from '../../lib/format'
import { imageUrl } from '../../lib/images'
import { buttonClass } from '../../components/Button'
import { ConfirmDialog, FilterChip, Notice, StatusPill, productStatus, useDocTitle, PlusIcon, SearchIcon } from '../ui'

const UploadIcon = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15V3M7 8l5-5 5 5" />
    <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </svg>
)

const LOW = 3
const totalStock = (p) => p.variants.reduce((n, v) => n + v.stock, 0)
const FILTERS = {
  All: () => true,
  Live: (p) => p.status === 'live',
  Drafts: (p) => p.status === 'draft',
  // Any size with 3 or fewer left (same rule as the Overview)
  'Low stock': (p) => p.variants.some((v) => v.stock <= LOW),
}

function priceRange(p) {
  const prices = p.variants.map(effectivePrice)
  if (!prices.length) return 'No price'
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  return lo === hi ? formatGHS(lo) : `${formatGHS(lo)} to ${hi.toLocaleString('en-US')}`
}

function Thumb({ p, i = 0, className = "w-12 h-14" }) {
  const cover = p.images[0]
  return (
    <div aria-hidden="true" className={`${className} shrink-0 rounded-[10px] overflow-hidden ${tintFor(i)}`}>
      {cover && <img src={imageUrl(cover.storage_path, 480)} alt="" loading="lazy" className="w-full h-full object-cover" />}
    </div>
  )
}

function Stock({ p }) {
  const n = totalStock(p)
  return n <= LOW ? <span className="font-extrabold text-rose whitespace-nowrap">{n} left</span> : <span>{n}</span>
}

const sizesText = (p) => p.variants.map((v) => v.size_label).join(', ') || 'No sizes yet'

export default function Products() {
  useDocTitle('Products')
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const showImport = params.get('import') === '1'
  const setShowImport = (on) => setParams(on ? { import: '1' } : {}, { replace: true })
  const [products, setProducts] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState(() => (new URLSearchParams(location.search).get('filter') === 'low' ? 'Low stock' : 'All'))
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(() =>
    location.state?.message ? { tone: 'success', text: location.state.message } : null,
  ) // { tone, text }
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      setProducts(await adminFetch('/products'))
    } catch (err) {
      setLoadError(err.message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const list = useMemo(() => products || [], [products])
  const counts = useMemo(
    () => Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, list.filter(f).length])),
    [list],
  )
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list
      .filter(FILTERS[filter])
      .filter((p) => !q || [p.name, p.brand, p.category?.name].some((s) => s && s.toLowerCase().includes(q)))
  }, [list, filter, query])

  const allShownSelected = rows.length > 0 && rows.every((p) => selected.has(p.id))
  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(rows.map((p) => p.id)))

  async function bulk(action) {
    const ids = [...selected]
    setBusy(true)
    setMessage(null)
    try {
      await adminFetch('/products/bulk', { method: 'POST', body: { ids, action } })
      const word = { show: 'now live in the shop', hide: 'hidden from the shop', delete: 'deleted' }[action]
      setMessage({ tone: 'success', text: `${ids.length} ${ids.length === 1 ? 'product' : 'products'} ${word}.` })
      setSelected(new Set())
      setConfirmDelete(false)
      await load()
    } catch (err) {
      setMessage({ tone: 'danger', text: err.message })
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="m-0 font-display font-normal text-[40px] leading-[1.1]">Products</h1>
          <span className="text-muted">
            {products ? `${list.length} ${list.length === 1 ? 'product' : 'products'} in your shop` : ' '}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            aria-expanded={showImport}
            onClick={() => setShowImport(!showImport)}
            className={buttonClass({ variant: 'secondary', size: 'md', className: 'bg-white px-5' })}
          >
            <UploadIcon />
            Import from spreadsheet
          </button>
          <Link to="/admin/products/new" className={buttonClass({ size: 'md', className: 'px-[22px]' })}>
            <PlusIcon />
            Add product
          </Link>
        </div>
      </div>

      {showImport && <ImportPanel onClose={() => setShowImport(false)} />}

      <div className="flex flex-wrap justify-between items-center gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {Object.keys(FILTERS).map((k) => (
            <FilterChip key={k} label={k} count={counts[k]} on={filter === k} onClick={() => setFilter(k)} />
          ))}
        </div>
        <label className="flex-[0_1_320px] w-full flex items-center gap-2.5 min-h-[46px] px-4 bg-white border-[1.5px] border-field rounded-full text-muted focus-within:border-ink">
          <SearchIcon />
          <span className="sr-only">Search products</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="flex-1 min-w-0 border-0 bg-transparent text-[16px] text-ink placeholder:text-strike outline-offset-4 min-h-11"
          />
        </label>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {selected.size > 0 && (
        <div
          role="region"
          aria-label="Selected products"
          className="sticky top-14 nav:top-0 z-20 flex flex-wrap items-center gap-2 bg-ink text-paper rounded-admin px-4 py-2"
        >
          <span className="font-bold mr-auto">{selected.size} selected</span>
          {[
            ['show', 'Show'],
            ['hide', 'Hide'],
          ].map(([a, l]) => (
            <button
              key={a}
              type="button"
              disabled={busy}
              onClick={() => bulk(a)}
              className="min-h-11 px-4 rounded-full font-bold text-[14px] bg-ink-2 text-paper border-0 cursor-pointer disabled:opacity-60"
            >
              {l}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
            className="min-h-11 px-4 rounded-full font-bold text-[14px] bg-transparent text-rose-light border-[1.5px] border-on-ink-line cursor-pointer"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="min-h-11 px-3 font-bold text-[14px] bg-transparent text-on-ink-muted border-0 cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {loadError ? (
        <div className="bg-white rounded-admin p-6 flex flex-col gap-3 items-start">
          <Notice tone="danger">{loadError}</Notice>
          <button type="button" onClick={load} className={buttonClass({ variant: 'secondary', size: 'md' })}>
            Try again
          </button>
        </div>
      ) : !products ? (
        <div className="bg-white rounded-admin p-6 text-muted" role="status">
          Loading products...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-admin p-8 flex flex-col gap-3 items-start">
          <p className="m-0 font-bold text-[17px]">
            {list.length === 0 ? 'No products yet.' : query ? `Nothing matches "${query}".` : `No products in ${filter}.`}
          </p>
          {list.length === 0 && (
            <Link to="/admin/products/new" className={buttonClass({ size: 'md' })}>
              Add your first product
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Phones: card list */}
          <ul className="sm:hidden m-0 p-0 list-none flex flex-col gap-2.5">
            {rows.map((p, i) => {
              const st = productStatus(p)
              return (
                <li key={p.id} className="bg-white rounded-admin flex items-stretch">
                  <label className="flex items-center pl-3 pr-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      aria-label={`Select ${p.name}`}
                      className="w-5 h-5 accent-ink"
                    />
                  </label>
                  <Link
                    to={`/admin/products/${p.id}`}
                    className="flex-1 min-w-0 flex items-center gap-3 p-3 pl-2 no-underline text-ink"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Thumb p={p} i={i} />
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="font-bold truncate">{p.name}</span>
                      <span className="text-[13px] text-muted truncate">
                        {p.category?.name} · {sizesText(p)}
                      </span>
                      <span className="flex items-center gap-2 text-[14px] mt-0.5">
                        <span className="font-bold">{priceRange(p)}</span>
                        <span className="text-muted">·</span>
                        <Stock p={p} />
                      </span>
                    </span>
                    <StatusPill tone={st.tone}>{st.label}</StatusPill>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Tablet and up: table, as in the mockup */}
          <div className="hidden sm:block bg-white rounded-admin overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  <th scope="col" className="pl-5 pr-1 py-4 w-10">
                    <label className="inline-grid place-items-center w-11 h-11 -m-3 cursor-pointer align-middle">
                      <input
                        type="checkbox"
                        checked={allShownSelected}
                        onChange={toggleAll}
                        aria-label="Select all shown products"
                        className="w-5 h-5 accent-ink"
                      />
                    </label>
                  </th>
                  <th scope="col" className="px-3 py-4 font-bold">Product</th>
                  <th scope="col" className="px-3 py-4 font-bold">Category</th>
                  <th scope="col" className="px-3 py-4 font-bold">Price</th>
                  <th scope="col" className="px-3 py-4 font-bold">Stock</th>
                  <th scope="col" className="px-3 py-4 font-bold">Status</th>
                  <th scope="col" className="px-5 py-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => {
                  const st = productStatus(p)
                  return (
                    <tr
                      key={p.id}
                      onClick={(e) => {
                        if (!e.target.closest('a,button,input,label')) navigate(`/admin/products/${p.id}`)
                      }}
                      className="border-t border-line-soft cursor-pointer hover:bg-paper"
                    >
                      <td className="pl-5 pr-1 py-3.5">
                        <label className="inline-grid place-items-center w-11 h-11 -m-3 cursor-pointer align-middle">
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggle(p.id)}
                            aria-label={`Select ${p.name}`}
                            className="w-5 h-5 accent-ink"
                          />
                        </label>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-3.5">
                          <Thumb p={p} i={i} />
                          <div className="flex flex-col">
                            <span className="font-bold">{p.name}</span>
                            <span className="text-[13px] text-muted">{sizesText(p)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-muted-2">{p.category?.name}</td>
                      <td className="px-3 py-3.5 font-bold whitespace-nowrap">{priceRange(p)}</td>
                      <td className="px-3 py-3.5">
                        <Stock p={p} />
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusPill tone={st.tone}>{st.label}</StatusPill>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/admin/products/${p.id}`}
                          aria-label={`Edit ${p.name}`}
                          className="inline-flex items-center min-h-11 px-4 border-[1.5px] border-field rounded-full text-ink no-underline font-bold text-[14px] hover:border-ink"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${selected.size} ${selected.size === 1 ? 'product' : 'products'}?`}
        body="They will be removed from the shop and their photos deleted. Past orders keep their details. This cannot be undone."
        confirmLabel="Delete for good"
        busy={busy}
        onConfirm={() => bulk('delete')}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminFetch } from '../../lib/adminApi'
import { buttonClass } from '../../components/Button'
import { useAdminCounts } from '../../stores/useAdminCounts'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { FilterChip, Notice, SearchIcon, useDocTitle } from '../ui'
import { OrderRows } from '../orderUi'

const CHIPS = [
  ['new', 'New'],
  ['paid', 'Paid'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
  ['unpaid', 'Unpaid'],
]
const EMPTY = {
  new: 'No new orders right now. New paid orders appear here.',
  paid: 'No paid orders yet.',
  out_for_delivery: 'Nothing is out for delivery.',
  delivered: 'No delivered orders yet.',
  cancelled: 'No cancelled orders.',
  unpaid: 'No unpaid checkouts. Orders appear here when someone starts paying and stops.',
  attention: 'Nothing needs your attention.',
}

export default function Orders() {
  useDocTitle('Orders')
  const [params, setParams] = useSearchParams()
  const filter = params.get('filter') || 'new'
  const page = Number(params.get('page')) || 1
  const [query, setQuery] = useState(params.get('q') || '')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const setCounts = useAdminCounts((s) => s.setCounts)
  const shopName = useSettingsStore((s) => s.settings.shop_name)

  const q = params.get('q') || ''
  const load = useCallback(async () => {
    setError('')
    try {
      const res = await adminFetch(`/orders?filter=${filter}&page=${page}&q=${encodeURIComponent(q)}`)
      setData(res)
      setCounts(res.counts)
    } catch (err) {
      setError(err.message)
    }
  }, [filter, page, q, setCounts])

  useEffect(() => {
    load()
    // New orders keep arriving: refresh every minute and when the tab comes back into view.
    const t = setInterval(load, 60_000)
    const onFocus = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [load])

  // Search as you type, after a short pause
  useEffect(() => {
    if (query === q) return
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (query.trim()) next.set('q', query.trim())
      else next.delete('q')
      next.delete('page')
      setParams(next, { replace: true })
    }, 350)
    return () => clearTimeout(t)
  }, [query, q, params, setParams])

  const choose = (key) => {
    const next = new URLSearchParams(params)
    next.set('filter', key)
    next.delete('page')
    setParams(next)
  }
  const goPage = (n) => {
    const next = new URLSearchParams(params)
    next.set('page', String(n))
    setParams(next)
  }

  const counts = data?.counts || {}
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const fresh = data && data.filter === filter

  return (
    <>
      <div className="flex flex-col">
        <h1 className="m-0 font-display font-normal text-[40px] leading-[1.1]">Orders</h1>
        <span className="text-muted">
          {counts.new ? `${counts.new} new ${counts.new === 1 ? 'order' : 'orders'} to pack` : 'All caught up'}
        </span>
      </div>

      {counts.attention > 0 && filter !== 'attention' && (
        <div role="status" className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-admin bg-danger-bg text-danger font-bold">
          <span className="mr-auto">
            {counts.attention} {counts.attention === 1 ? 'order needs' : 'orders need'} your attention (stock ran out or the payment did not match).
          </span>
          <button
            type="button"
            onClick={() => choose('attention')}
            className="min-h-11 px-4 rounded-full bg-white text-danger border-0 font-bold cursor-pointer"
          >
            Show {counts.attention === 1 ? 'it' : 'them'}
          </button>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {CHIPS.map(([k, label]) => (
            <FilterChip key={k} label={label} count={counts[k] ?? ''} on={filter === k} onClick={() => choose(k)} />
          ))}
          {filter === 'attention' && <FilterChip label="Needs attention" count={counts.attention ?? ''} on onClick={() => {}} />}
        </div>
        <label className="flex-[0_1_320px] w-full flex items-center gap-2.5 min-h-[46px] px-4 bg-white border-[1.5px] border-field rounded-full text-muted focus-within:border-ink">
          <SearchIcon />
          <span className="sr-only">Search orders</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order number, name or phone"
            className="flex-1 min-w-0 border-0 bg-transparent text-[16px] text-ink placeholder:text-strike outline-offset-4 min-h-11"
          />
        </label>
      </div>

      {error && !data ? (
        <div className="bg-white rounded-admin p-6 flex flex-col gap-3 items-start">
          <Notice tone="danger">{error}</Notice>
          <button type="button" onClick={load} className={buttonClass({ variant: 'secondary', size: 'md' })}>
            Try again
          </button>
        </div>
      ) : !fresh ? (
        <div className="bg-white rounded-admin p-6 text-muted" role="status">
          Loading orders...
        </div>
      ) : data.orders.length === 0 ? (
        <div className="bg-white rounded-admin p-8">
          <p className="m-0 font-bold text-[17px]">{q ? `No orders match "${q}".` : EMPTY[filter]}</p>
        </div>
      ) : (
        <>
          {error && <Notice tone="danger">{error}</Notice>}
          <OrderRows orders={data.orders} shopName={shopName} />
          {pages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goPage(page - 1)}
                className={buttonClass({ variant: 'secondary', size: 'md', className: 'bg-white' })}
              >
                Newer
              </button>
              <span className="text-muted text-[14px]">
                Page {page} of {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => goPage(page + 1)}
                className={buttonClass({ variant: 'secondary', size: 'md', className: 'bg-white' })}
              >
                Older
              </button>
            </nav>
          )}
        </>
      )}
    </>
  )
}

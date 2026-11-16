import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminFetch } from '../../lib/adminApi'
import { formatGHS } from '../../lib/format'
import { buttonClass } from '../../components/Button'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { Notice, useDocTitle } from '../ui'
import { OrderRows } from '../orderUi'

function Stat({ label, value, to, hint, warn }) {
  const body = (
    <>
      <span className="text-[14px] font-bold text-muted-2">{label}</span>
      <span className={`font-display text-[36px] leading-none ${warn ? 'text-rose' : 'text-ink'}`}>{value}</span>
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
    </>
  )
  const cls = 'bg-white rounded-admin p-5 flex flex-col gap-2.5 min-h-[128px] no-underline text-ink'
  return to ? (
    <Link to={to} className={`${cls} hover:outline hover:outline-[1.5px] hover:outline-field`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Overview() {
  useDocTitle('Overview')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const shopName = useSettingsStore((s) => s.settings.shop_name)
  const email = useAuthStore((s) => s.user?.email)

  const load = useCallback(async () => {
    setError('')
    try {
      setData(await adminFetch('/overview'))
    } catch (err) {
      setError(err.message)
    }
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="m-0 font-display font-normal text-[40px] leading-[1.1]">{greeting()}</h1>
          <span className="text-muted">
            {today}
            {email ? ` · ${email}` : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/admin/orders" className={buttonClass({ variant: 'secondary', size: 'md', className: 'bg-white' })}>
            See orders
          </Link>
          <Link to="/admin/products/new" className={buttonClass({ size: 'md' })}>
            Add product
          </Link>
        </div>
      </div>

      {error && !data && (
        <div className="bg-white rounded-admin p-6 flex flex-col gap-3 items-start">
          <Notice tone="danger">{error}</Notice>
          <button type="button" onClick={load} className={buttonClass({ variant: 'secondary', size: 'md' })}>
            Try again
          </button>
        </div>
      )}
      {!data && !error && (
        <div className="bg-white rounded-admin p-6 text-muted" role="status">
          Loading...
        </div>
      )}

      {data && (
        <>
          {data.needs_attention > 0 && (
            <Link
              to="/admin/orders?filter=attention"
              className="flex items-center justify-between gap-3 min-h-12 px-5 py-3 rounded-admin bg-danger-bg text-danger font-bold no-underline"
            >
              {data.needs_attention} {data.needs_attention === 1 ? 'order needs' : 'orders need'} your attention
              <span aria-hidden="true">→</span>
            </Link>
          )}

          <section aria-label="Today" className="grid gap-3 grid-cols-2 nav:grid-cols-4">
            <Stat label="Today's sales" value={formatGHS(data.sales_today_ghs)} hint="Paid orders since midnight" />
            <Stat label="Orders today" value={data.orders_today} to="/admin/orders?filter=paid" />
            <Stat
              label="Low on stock"
              value={data.low_stock_products}
              hint={`${data.low_stock_products === 1 ? 'Product' : 'Products'} with 3 or fewer left`}
              to="/admin/products?filter=low"
              warn={data.low_stock_products > 0}
            />
            <Stat
              label="To send out"
              value={data.unfulfilled}
              hint="Paid, not delivered yet"
              to="/admin/orders?filter=new"
              warn={data.unfulfilled > 0}
            />
          </section>

          <div className="grid gap-5 nav:grid-cols-[minmax(0,1fr)_340px] items-start">
            <section aria-labelledby="latest-h" className="flex flex-col gap-3 min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="latest-h" className="m-0 text-[18px] font-extrabold">
                  Latest orders
                </h2>
                <Link to="/admin/orders?filter=paid" className="text-[14px] font-bold text-ink min-h-11 inline-flex items-center">
                  See all
                </Link>
              </div>
              {data.latest.length ? (
                <OrderRows orders={data.latest} shopName={shopName} compact />
              ) : (
                <div className="bg-white rounded-admin p-6 text-muted-2">
                  No paid orders yet. When someone pays, their order shows up here and in Orders.
                </div>
              )}
            </section>

            <section aria-labelledby="low-h" className="bg-white rounded-admin p-5 flex flex-col gap-3">
              <h2 id="low-h" className="m-0 text-[18px] font-extrabold">
                Low on stock
              </h2>
              {data.low_stock.length ? (
                <ul className="m-0 p-0 list-none flex flex-col">
                  {data.low_stock.map((v) => (
                    <li key={v.variant_id} className="border-b border-line-soft last:border-0">
                      <Link
                        to={`/admin/products/${v.product_id}`}
                        className="flex items-center justify-between gap-3 min-h-12 py-2 no-underline text-ink hover:underline underline-offset-2"
                      >
                        <span className="flex flex-col">
                          <span className="font-bold">{v.name}</span>
                          <span className="text-[13px] text-muted">{v.size_label}</span>
                        </span>
                        <span className={`font-extrabold whitespace-nowrap ${v.stock === 0 ? 'text-danger' : 'text-rose'}`}>
                          {v.stock === 0 ? 'Sold out' : `${v.stock} left`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-muted-2">Everything in the shop has more than 3 in stock.</p>
              )}
            </section>
          </div>
        </>
      )}
    </>
  )
}

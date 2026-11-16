import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminFetch } from '../../lib/adminApi'
import { formatGHS } from '../../lib/format'
import { buttonClass } from '../../components/Button'
import { useImportStore } from '../../stores/useImportStore'
import { FilterChip, Notice, StatusPill, useDocTitle } from '../ui'

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function Price({ r }) {
  if (r.price == null) return <span className="text-muted">-</span>
  return (
    <span className="whitespace-nowrap">
      <span className="font-bold">{formatGHS(r.sale_price ?? r.price)}</span>
      {r.sale_price != null && <s className="ml-1.5 text-[13px] text-strike">{formatGHS(r.price)}</s>}
    </span>
  )
}

function Problems({ r }) {
  if (!r.errors.length && !r.warnings.length) return <span className="text-muted">Ready to import</span>
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-0.5">
      {r.errors.map((e) => (
        <li key={e} className="text-danger font-semibold">
          {e}
        </li>
      ))}
      {r.warnings.map((w) => (
        <li key={w} className="text-muted">
          {w}
        </li>
      ))}
    </ul>
  )
}

export default function ImportReview() {
  useDocTitle('Check your import')
  const { fileName, preview, clear } = useImportStore()
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState('') // '' | 'draft' | 'live'
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const rows = useMemo(() => preview?.rows || [], [preview])
  const shown = useMemo(
    () => rows.filter((r) => filter === 'all' || (filter === 'ready' ? r.status === 'ready' : r.status === 'error')),
    [rows, filter],
  )

  async function commit(publish) {
    setError('')
    setBusy(publish ? 'live' : 'draft')
    try {
      const res = await adminFetch('/import/commit', { method: 'POST', body: { rows, publish } })
      setResult(res)
      clear()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const header = (
    <div className="flex flex-col gap-1.5">
      <nav aria-label="Breadcrumb" className="flex gap-2 text-[14px] text-muted">
        <Link to="/admin/products" className="text-muted">
          Products
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Import</span>
      </nav>
      <h1 className="m-0 font-display font-normal text-[40px] leading-[1.1]">
        {result ? 'Import finished' : 'Check your import'}
      </h1>
    </div>
  )

  // ---- after importing ----
  if (result) {
    const where = result.status === 'live' ? 'live in your shop' : 'as drafts. Shoppers cannot see them yet'
    return (
      <>
        {header}
        <div className="bg-white rounded-admin p-5 sm:p-6 flex flex-col gap-4">
          {result.created > 0 ? (
            <Notice>{`${plural(result.created, 'product', 'products')} added ${where}.`}</Notice>
          ) : (
            <Notice tone="danger">No products were added. They may already be in your shop.</Notice>
          )}
          {result.skipped_rows > 0 && (
            <p className="m-0 text-muted-2">
              {plural(result.skipped_rows, 'row was', 'rows were')} skipped because {result.skipped_rows === 1 ? 'it needs' : 'they need'} fixing.
            </p>
          )}
          {result.failed.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-bold text-danger">These could not be saved:</span>
              <ul className="m-0 pl-5">
                {result.failed.map((f) => (
                  <li key={f.name}>
                    {f.name} (row {f.rows.join(', ')}): {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-bold">Photos to check:</span>
              <ul className="m-0 pl-5 text-muted-2">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Link to="/admin/products" className={buttonClass({ size: 'md' })}>
              See products
            </Link>
            <Link to="/admin/products?import=1" className={buttonClass({ variant: 'secondary', size: 'md' })}>
              Import another file
            </Link>
          </div>
        </div>
      </>
    )
  }

  // ---- nothing to review (e.g. opened directly) ----
  if (!preview) {
    return (
      <>
        {header}
        <div className="bg-white rounded-admin p-6 flex flex-col gap-4 items-start">
          <p className="m-0 text-muted-2">There is no spreadsheet to check yet. Upload one from the Products page.</p>
          <Link to="/admin/products?import=1" className={buttonClass({ size: 'md' })}>
            Upload a spreadsheet
          </Link>
        </div>
      </>
    )
  }

  const { summary } = preview
  const ready = summary.products_ready
  const working = busy !== ''

  return (
    <>
      {header}

      <div className="bg-white rounded-admin p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="m-0 text-[20px] font-extrabold">
            {plural(ready, 'product', 'products')} ready
            {summary.rows_with_errors > 0 && (
              <>
                <span className="text-muted font-bold"> · </span>
                <span className="text-rose">{summary.rows_with_errors} need fixing</span>
              </>
            )}
          </p>
          <span className="text-muted text-[14px] break-all">
            From {fileName}: {plural(summary.rows_ready, 'size', 'sizes')}
            {summary.photos > 0 ? `, ${plural(summary.photos, 'photo link', 'photo links')}` : ''}.
          </span>
          {summary.rows_with_errors > 0 && (
            <span className="text-muted-2 text-[14px]">
              Rows that need fixing are skipped. Fix them in your spreadsheet and upload it again any time.
            </span>
          )}
        </div>

        {ready > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            <button type="button" disabled={working} onClick={() => commit(false)} className={buttonClass({ size: 'md' })}>
              {busy === 'draft' ? 'Importing...' : `Import ${ready} as drafts`}
            </button>
            <button type="button" disabled={working} onClick={() => commit(true)} className={buttonClass({ variant: 'secondary', size: 'md' })}>
              {busy === 'live' ? 'Importing...' : 'Import and publish'}
            </button>
            <Link to="/admin/products?import=1" className="min-h-12 inline-flex items-center px-2 font-bold text-ink underline underline-offset-4">
              Upload a different file
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 items-start">
            <p className="m-0 font-bold">Nothing can be imported yet. Fix the rows below in your spreadsheet, then upload it again.</p>
            <Link to="/admin/products?import=1" className={buttonClass({ size: 'md' })}>
              Upload the fixed file
            </Link>
          </div>
        )}
        {working && (
          <p role="status" className="m-0 text-muted text-[14px]">
            Importing. Keep this page open{summary.photos > 0 ? ', photos can take a minute' : ''}.
          </p>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </div>

      <div role="group" aria-label="Show rows" className="flex flex-wrap gap-2">
        <FilterChip label="All rows" count={rows.length} on={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterChip label="Ready" count={summary.rows_ready} on={filter === 'ready'} onClick={() => setFilter('ready')} />
        <FilterChip label="Need fixing" count={summary.rows_with_errors} on={filter === 'error'} onClick={() => setFilter('error')} />
      </div>

      {/* Phones: cards */}
      <ul className="sm:hidden m-0 p-0 list-none flex flex-col gap-2.5">
        {shown.map((r) => (
          <li key={r.row} className="bg-white rounded-admin p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] text-muted">Row {r.row}</span>
                <span className="font-bold break-words">{r.name || 'No name'}</span>
                <span className="text-[14px] text-muted-2">
                  {[r.category, r.size].filter(Boolean).join(' · ')}
                </span>
              </div>
              <StatusPill tone={r.status === 'ready' ? 'success' : 'danger'}>{r.status === 'ready' ? 'Ready' : 'Needs fixing'}</StatusPill>
            </div>
            <div className="flex gap-3 text-[14px]">
              <Price r={r} />
              {r.stock != null && <span className="text-muted">Stock {r.stock}</span>}
            </div>
            <div className="text-[14px]">
              <Problems r={r} />
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and up: table */}
      <div className="hidden sm:block bg-white rounded-admin overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[14px]">
          <thead>
            <tr className="text-left text-[13px] text-muted">
              <th scope="col" className="pl-5 pr-3 py-4 font-bold">Row</th>
              <th scope="col" className="px-3 py-4 font-bold">Product</th>
              <th scope="col" className="px-3 py-4 font-bold">Size</th>
              <th scope="col" className="px-3 py-4 font-bold">Price</th>
              <th scope="col" className="px-3 py-4 font-bold">Stock</th>
              <th scope="col" className="px-3 py-4 font-bold">Status</th>
              <th scope="col" className="pl-3 pr-5 py-4 font-bold">What to fix</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.row} className="border-t border-line-soft align-top">
                <td className="pl-5 pr-3 py-3.5 text-muted">{r.row}</td>
                <td className="px-3 py-3.5">
                  <div className="flex flex-col">
                    <span className="font-bold">{r.name || 'No name'}</span>
                    <span className="text-[13px] text-muted">
                      {r.category}
                      {r.photos > 0 ? ` · ${plural(r.photos, 'photo', 'photos')}` : ''}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3.5">{r.size || <span className="text-muted">-</span>}</td>
                <td className="px-3 py-3.5">
                  <Price r={r} />
                </td>
                <td className="px-3 py-3.5">{r.stock ?? <span className="text-muted">-</span>}</td>
                <td className="px-3 py-3.5">
                  <StatusPill tone={r.status === 'ready' ? 'success' : 'danger'}>{r.status === 'ready' ? 'Ready' : 'Needs fixing'}</StatusPill>
                </td>
                <td className="pl-3 pr-5 py-3.5 max-w-[360px]">
                  <Problems r={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="m-0 text-muted">No rows here.</p>}
    </>
  )
}

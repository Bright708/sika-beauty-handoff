import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminDownload, adminUpload } from '../lib/adminApi'
import { useImportStore } from '../stores/useImportStore'
import { CloseIcon, Notice } from './ui'

// "Add many products at once" panel from admin-products.html.
const step = 'p-5 bg-paper rounded-tile flex flex-col gap-2.5'
const smallBtn =
  'self-start min-h-11 px-[18px] cursor-pointer text-[14px] font-bold text-ink bg-white border-[1.5px] border-ink rounded-full hover:bg-ink hover:text-paper disabled:opacity-60 disabled:cursor-wait'

export default function ImportPanel({ onClose }) {
  const navigate = useNavigate()
  const setPreview = useImportStore((s) => s.setPreview)
  const [busy, setBusy] = useState('') // '' | 'template' | 'checking'
  const [error, setError] = useState('')

  async function downloadTemplate() {
    setError('')
    setBusy('template')
    try {
      await adminDownload('/import/template', 'sika-products-template.xlsx')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow choosing the same file again after fixing it
    if (!file) return
    setError('')
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return setError('Please choose an .xlsx or .csv file.')
    if (file.size > 5 * 1024 * 1024) return setError('That file is over 5 MB. Split it into smaller files.')
    setBusy('checking')
    try {
      const preview = await adminUpload('/import/preview', file)
      setPreview(file.name, preview)
      navigate('/admin/import/review')
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  return (
    <section aria-labelledby="imp-h" className="bg-white rounded-admin p-5 sm:p-7 flex flex-col gap-[22px] border-[1.5px] border-ink">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="imp-h" className="m-0 text-[20px] font-extrabold">
            Add many products at once
          </h2>
          <span className="text-muted">Fill in a spreadsheet, one row per product size, then upload it here.</span>
        </div>
        <button
          type="button"
          aria-label="Close import"
          onClick={onClose}
          className="w-11 h-11 shrink-0 grid place-items-center cursor-pointer bg-shell border-0 rounded-full text-ink"
        >
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
        <div className={step}>
          <span className="font-extrabold">1. Get the template</span>
          <span className="text-muted text-[14px]">Opens in Excel or Google Sheets.</span>
          <button type="button" onClick={downloadTemplate} disabled={busy !== ''} className={smallBtn}>
            {busy === 'template' ? 'Downloading...' : 'Download template'}
          </button>
        </div>
        <div className={step}>
          <span className="font-extrabold">2. Fill in your products</span>
          <span className="text-muted text-[14px]">
            Columns: name, category, size, price, sale price, stock, description, photo link.
          </span>
        </div>
        <label
          className={`p-5 border-2 border-dashed border-dash rounded-tile flex flex-col items-center justify-center gap-2 text-center cursor-pointer hover:border-rose focus-within:outline-2 focus-within:outline-rose focus-within:outline-offset-2 ${
            busy === 'checking' ? 'opacity-70 cursor-wait' : ''
          }`}
        >
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-rose">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
            <path d="M9 14h6M9 17h4" />
          </svg>
          <span className="font-extrabold">{busy === 'checking' ? 'Checking your file...' : '3. Upload the file'}</span>
          <span className="text-muted text-[14px]">.xlsx or .csv. You'll check everything before it goes live.</span>
          <span className="min-h-11 inline-flex items-center px-[18px] rounded-full bg-ink text-paper text-[14px] font-bold">
            Choose file
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            disabled={busy === 'checking'}
            onChange={onFile}
            className="sr-only"
          />
        </label>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </section>
  )
}

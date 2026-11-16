import { useEffect, useId, useRef } from 'react'

// Shared admin building blocks, styled from admin-products.html and admin-add-product.html.

export const inputClass =
  'w-full min-h-[50px] px-4 font-sans text-[16px] text-ink bg-paper border-[1.5px] border-field rounded-input placeholder:text-strike aria-[invalid=true]:border-rose'

export function useDocTitle(title) {
  useEffect(() => {
    document.title = `${title} · Sika admin`
  }, [title])
}

// Label + control + optional hint/error. `children` is a render function receiving the a11y props.
export function Field({ label, hint, error, optional, small, className = '', children }) {
  const id = useId()
  const errId = `${id}-err`
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={`font-bold ${small ? 'text-[13px]' : 'text-[14px]'}`}>
        {label}
        {optional && <span className="font-medium text-muted"> (optional)</span>}
      </label>
      {hint && <span className="text-[13px] text-muted -mt-1">{hint}</span>}
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? errId : undefined })}
      {error && (
        <span id={errId} className="text-[13px] font-bold text-rose">
          {error}
        </span>
      )}
    </div>
  )
}

export function Card({ title, subtitle, id, className = '', children }) {
  const hid = useId()
  return (
    <section
      id={id}
      aria-labelledby={title ? hid : undefined}
      className={`bg-white rounded-admin p-5 sm:p-6 flex flex-col gap-4 ${className}`}
    >
      {title && (
        <div className="flex flex-col">
          <h2 id={hid} className="m-0 text-[18px] font-extrabold">
            {title}
          </h2>
          {subtitle && <span className="text-[14px] text-muted">{subtitle}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

const PILL = {
  success: 'bg-success-bg text-success',
  neutral: 'bg-neutral-bg text-neutral',
  danger: 'bg-danger-bg text-danger',
  accent: 'bg-blush text-ink',
}
export function StatusPill({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-[13px] font-extrabold whitespace-nowrap ${PILL[tone]}`}>
      {children}
    </span>
  )
}

// Live / Draft / Sold out, from the products mockup
export function productStatus(p) {
  if (p.status === 'draft') return { label: 'Draft', tone: 'neutral' }
  if (!p.variants.some((v) => v.stock > 0)) return { label: 'Sold out', tone: 'danger' }
  return { label: 'Live', tone: 'success' }
}

export function FilterChip({ on, onClick, label, count }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 px-4 rounded-full text-[14px] font-bold border-[1.5px] cursor-pointer ${
        on ? 'bg-ink text-paper border-ink' : 'bg-white text-ink border-field hover:border-ink'
      }`}
    >
      {label} <span className={on ? 'opacity-75' : 'text-muted'}>{count}</span>
    </button>
  )
}

// Accessible confirm dialog built on <dialog> (focus trap and Escape for free).
export function ConfirmDialog({ open, title, body, confirmLabel, busyLabel = 'Deleting...', cancelLabel = 'Keep it', busy, onConfirm, onCancel, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
      className="m-auto w-[min(440px,calc(100vw-32px))] p-0 rounded-admin bg-white text-ink backdrop:bg-ink/50"
    >
      <div className="p-6 flex flex-col gap-4">
        <h2 className="m-0 text-[20px] font-extrabold">{title}</h2>
        <p className="m-0 text-muted-2">{body}</p>
        {children}
        <div className="flex flex-wrap gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-12 px-5 rounded-full font-bold border-[1.5px] border-field bg-white cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="min-h-12 px-5 rounded-full font-bold text-white bg-danger border-[1.5px] border-danger cursor-pointer disabled:opacity-60"
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export function Notice({ tone = 'success', children }) {
  const cls = tone === 'success' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'
  return (
    <p role={tone === 'success' ? 'status' : 'alert'} className={`m-0 px-3.5 py-3 rounded-input font-bold text-[14px] ${cls}`}>
      {children}
    </p>
  )
}

// ---- admin icons (from the mockups) ----
const ic = {
  'aria-hidden': true,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}
export const OverviewIcon = ({ size = 18 }) => (
  <svg {...ic} width={size} height={size}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
)
export const OrdersIcon = ({ size = 18 }) => (
  <svg {...ic} width={size} height={size}>
    <path d="M5 8h14l-1 12H6L5 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
)
export const ProductsIcon = ({ size = 18 }) => (
  <svg {...ic} width={size} height={size}>
    <path d="M9 3h6v4H9z" />
    <path d="M7 7h10l1 14H6z" />
  </svg>
)
export const SettingsIcon = ({ size = 18 }) => (
  <svg {...ic} width={size} height={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </svg>
)
export const PlusIcon = ({ size = 18 }) => (
  <svg {...ic} width={size} height={size} strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const PhotoIcon = ({ size = 30 }) => (
  <svg {...ic} width={size} height={size}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M21 16l-5-5-8 8" />
  </svg>
)
export const GripIcon = ({ size = 18 }) => (
  <svg {...ic} width={size} height={size} strokeWidth="2.4">
    <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
  </svg>
)
export const CloseIcon = ({ size = 18 }) => (
  <svg {...ic} width={size} height={size} strokeWidth="2">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const SearchIcon = ({ size = 18 }) => (
  <svg {...ic} width={size} height={size}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
)

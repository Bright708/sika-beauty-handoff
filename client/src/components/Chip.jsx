import { Link } from 'react-router-dom'

// Filter chip: 44px pill, active = ink fill.
const base =
  'inline-flex items-center min-h-11 px-5 text-[14px] font-bold rounded-full border-[1.5px] no-underline cursor-pointer whitespace-nowrap transition-colors duration-150'
const on = 'bg-ink text-paper border-ink'
const off = 'bg-transparent text-ink border-chip-line hover:border-ink'

// Toggle chip (button with aria-pressed)
export default function Chip({ active, children, ...rest }) {
  return (
    <button type="button" aria-pressed={!!active} className={`${base} ${active ? on : off}`} {...rest}>
      {children}
    </button>
  )
}

// Navigation chip (link with aria-current)
export function ChipLink({ to, active, children }) {
  return (
    <Link to={to} aria-current={active ? 'page' : undefined} className={`${base} ${active ? on : off}`}>
      {children}
    </Link>
  )
}

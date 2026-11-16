import { Link } from 'react-router-dom'
import { SHOP } from '../config/shop'

// "Sika." in Gloock. The dot is rose on paper, rose-light on ink.
export default function Logo({ size = 'header', onDark = false, as = 'link', className = '' }) {
  const sizeClass = size === 'footer' ? 'text-[40px]' : 'text-[32px]'
  const content = (
    <>
      {SHOP.logoWord}
      <span className={onDark ? 'text-rose-light' : 'text-rose'}>.</span>
    </>
  )
  const cls = `font-display ${sizeClass} tracking-[-0.01em] leading-none no-underline ${
    onDark ? 'text-paper' : 'text-ink'
  } ${className}`

  if (as === 'span') return <span className={cls}>{content}</span>
  return (
    <Link to="/" className={`${cls} inline-flex items-center min-h-11 -my-1.5`} aria-label={`${SHOP.name}, home`}>
      {content}
    </Link>
  )
}

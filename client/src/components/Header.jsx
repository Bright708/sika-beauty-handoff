import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Logo from './Logo'
import { SearchIcon, AccountIcon, BagIcon, MenuIcon, CloseIcon } from './Icons'
import { useBagCount, useBagStore } from '../stores/useBagStore'

export const NAV_LINKS = [
  { to: '/shop', label: 'Shop all' },
  { to: '/shop/perfume', label: 'Perfumes' },
  { to: '/shop/body-creams', label: 'Body creams' },
  { to: '/shop/gift-set', label: 'Gift sets' },
  { to: '/#story', label: 'Our story' },
]

const iconBtn =
  'w-11 h-11 flex items-center justify-center bg-transparent border-0 cursor-pointer text-ink rounded-full hover:bg-blush transition-colors duration-150'

export default function Header() {
  const count = useBagCount()
  const openBag = useBagStore((s) => s.open)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close the mobile menu whenever the route changes
  useEffect(() => setMenuOpen(false), [location.pathname, location.hash])

  return (
    <header className="bg-paper border-b border-line">
      <div className="container-shop min-h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`${iconBtn} -ml-2.5 nav:hidden`}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
          <Logo />
        </div>

        <nav aria-label="Main" className="hidden nav:flex flex-wrap gap-x-[30px] gap-y-1.5 text-[15px] font-semibold">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end
              className="text-ink no-underline min-h-11 inline-flex items-center hover:text-rose transition-colors duration-150"
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Link to="/shop" aria-label="Search products" className={iconBtn}>
            <SearchIcon />
          </Link>
          <Link to="/admin" aria-label="Account" className={`${iconBtn} hidden sm:flex`}>
            <AccountIcon />
          </Link>
          <button
            type="button"
            onClick={openBag}
            aria-label={`Bag, ${count} ${count === 1 ? 'item' : 'items'}`}
            className="ml-1.5 inline-flex items-center gap-2 min-h-11 px-[18px] bg-ink text-paper text-[14px] font-bold rounded-full cursor-pointer hover:bg-ink-2 transition-colors duration-150"
          >
            <BagIcon />
            Bag ({count})
          </button>
        </div>
      </div>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  )
}

function MobileMenu({ open, onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-50 bg-paper flex flex-col nav:hidden"
    >
      <div className="container-shop min-h-20 flex items-center justify-between border-b border-line">
        <Logo />
        <button ref={closeRef} type="button" aria-label="Close menu" className={`${iconBtn} -mr-2.5`} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <nav aria-label="Main" className="container-shop flex flex-col py-6 overflow-y-auto">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            onClick={onClose}
            className="font-display text-[40px] leading-[1.1] text-ink no-underline py-3 border-b border-line"
          >
            {l.label}
          </Link>
        ))}
        {/* The header's account icon is hidden on phones, so sign-in lives here */}
        <Link
          to="/admin"
          onClick={onClose}
          className="mt-4 self-start inline-flex items-center gap-2.5 min-h-12 px-5 rounded-full border-[1.5px] border-ink text-ink text-[16px] font-bold no-underline"
        >
          <AccountIcon />
          Sign in
        </Link>
      </nav>
      <div className="container-shop mt-auto pb-8 flex flex-col gap-1 text-[15px] text-muted">
        <span>Same-day delivery in Accra</span>
        <span>Pay with MoMo or card</span>
      </div>
    </div>
  )
}

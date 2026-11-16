import { Link } from 'react-router-dom'
import Logo from './Logo'
import { SHOP, waLink } from '../config/shop'

// Each link is a full 44px tap target, stacked with no gap
const linkCls = 'inline-flex items-center min-h-11 text-paper no-underline hover:text-rose-light transition-colors duration-150'

export default function Footer() {
  return (
    <footer className="bg-ink text-paper">
      <div className="container-shop pt-[72px] pb-8 flex flex-col gap-12">
        <div className="flex flex-wrap justify-between gap-10">
          <div className="flex flex-col gap-3 max-w-[320px]">
            <Logo size="footer" onDark />
            <span className="text-on-ink-muted">Perfumes and body creams, delivered across {SHOP.city}.</span>
          </div>
          <div className="flex flex-wrap gap-x-14 gap-y-8 text-[15px]">
            <nav aria-label="Shop" className="flex flex-col items-start">
              <span className="pb-1 text-[13px] font-extrabold text-on-ink-muted">Shop</span>
              <Link to="/shop/perfume" className={linkCls}>Perfumes</Link>
              <Link to="/shop/body-creams" className={linkCls}>Body creams</Link>
              <Link to="/shop/gift-set" className={linkCls}>Gift sets</Link>
            </nav>
            <nav aria-label="Help" className="flex flex-col items-start">
              <span className="pb-1 text-[13px] font-extrabold text-on-ink-muted">Help</span>
              <Link to="/#story" className={linkCls}>Delivery</Link>
              <Link to="/#story" className={linkCls}>Returns</Link>
              <a href={waLink()} target="_blank" rel="noreferrer" className={linkCls}>WhatsApp us</a>
            </nav>
            <nav aria-label="Follow" className="flex flex-col items-start">
              <span className="pb-1 text-[13px] font-extrabold text-on-ink-muted">Follow</span>
              <a href={SHOP.instagram} target="_blank" rel="noreferrer" className={linkCls}>Instagram</a>
              <a href={SHOP.tiktok} target="_blank" rel="noreferrer" className={linkCls}>TikTok</a>
            </nav>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-3 pt-6 border-t border-ink-2 text-[13px] text-on-ink-muted">
          <span>© {new Date().getFullYear()} {SHOP.name}, {SHOP.city}</span>
          <span>{SHOP.credit}</span>
        </div>
      </div>
    </footer>
  )
}

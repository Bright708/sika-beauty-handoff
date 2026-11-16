import { Suspense, useEffect } from 'react'
import { NavLink, Link, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { OverviewIcon, OrdersIcon, ProductsIcon, SettingsIcon, PlusIcon } from './ui'
import { SHOP } from '../config/shop'
import { useAdminCounts } from '../stores/useAdminCounts'
import { useSettingsStore } from '../stores/useSettingsStore'

// Desktop: ink sidebar. Phones: slim top bar + bottom tab bar (Orders, Products, Add, Settings).
const SIDEBAR = [
  { to: '/admin', label: 'Overview', icon: OverviewIcon, end: true },
  { to: '/admin/orders', label: 'Orders', icon: OrdersIcon },
  { to: '/admin/products', label: 'Products', icon: ProductsIcon },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
]
const TABS = [
  { to: '/admin/orders', label: 'Orders', icon: OrdersIcon },
  { to: '/admin/products', label: 'Products', icon: ProductsIcon, end: true },
  { to: '/admin/products/new', label: 'Add', icon: PlusIcon, add: true },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
]

function AdminLogo() {
  return (
    <Link to="/admin" className="flex items-center min-h-11 gap-2.5 px-3 no-underline text-paper" aria-label="Sika admin, overview">
      <span className="font-display text-[30px] leading-none">
        {SHOP.logoWord}
        <span className="text-rose-light">.</span>
      </span>
      <span className="text-[12px] font-bold text-on-ink-muted">Admin</span>
    </Link>
  )
}

// Guard: everything under it needs a signed-in admin.
export function RequireAdmin({ children }) {
  const status = useAuthStore((s) => s.status)
  const init = useAuthStore((s) => s.init)
  const loc = useLocation()
  useEffect(() => {
    init()
  }, [init])

  if (status === 'loading' || status === 'checking') {
    return (
      <div className="min-h-screen grid place-items-center bg-shell text-muted" role="status">
        Loading the admin...
      </div>
    )
  }
  if (status !== 'admin') {
    const next = encodeURIComponent(loc.pathname + loc.search)
    return <Navigate to={`/admin/login?next=${next}`} replace />
  }
  return children
}

function NewBadge({ onInk }) {
  const n = useAdminCounts((s) => s.counts?.new || 0)
  if (!n) return null
  return (
    <span
      className={`ml-auto min-w-6 h-6 px-1.5 rounded-full grid place-items-center text-[12px] font-extrabold ${
        onInk ? 'bg-rose text-white' : 'absolute -top-1 -right-1 bg-rose text-white'
      }`}
    >
      {n}
      <span className="sr-only"> new</span>
    </span>
  )
}

export default function AdminLayout() {
  const signOut = useAuthStore((s) => s.signOut)
  const refreshCounts = useAdminCounts((s) => s.refresh)
  const loadSettings = useSettingsStore((s) => s.load)
  useEffect(() => {
    loadSettings()
    refreshCounts()
    const t = setInterval(refreshCounts, 60_000)
    return () => clearInterval(t)
  }, [refreshCounts, loadSettings])
  useEffect(() => {
    // Keep the admin out of search engines
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex'
    document.head.appendChild(m)
    return () => m.remove()
  }, [])

  return (
    <div className="min-h-screen bg-shell text-ink text-[15px] leading-normal nav:flex">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-ink focus:text-paper focus:px-4 focus:py-3 focus:rounded-full"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden nav:flex sticky top-0 h-screen w-[260px] shrink-0 bg-ink text-paper px-5 py-7 flex-col gap-8">
        <AdminLogo />
        <nav aria-label="Admin" className="flex flex-col gap-1 font-semibold">
          {SIDEBAR.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 min-h-11 px-3 rounded-input no-underline ${
                  isActive ? 'bg-ink-2 text-paper' : 'text-on-ink-muted hover:text-paper'
                }`
              }
            >
              <Icon />
              {label}
              {to === '/admin/orders' && <NewBadge onInk />}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <Link
            to="/"
            className="flex items-center justify-center min-h-11 border border-on-ink-line rounded-full text-paper no-underline font-bold text-[14px] hover:bg-ink-2"
          >
            View shop
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="min-h-11 rounded-full text-on-ink-muted font-bold text-[14px] bg-transparent border-0 cursor-pointer hover:text-paper"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Phone / tablet top bar */}
      <header className="nav:hidden sticky top-0 z-30 bg-ink text-paper flex items-center justify-between gap-3 px-2 min-h-14">
        <AdminLogo />
        <div className="flex items-center">
          <Link to="/" className="min-h-11 px-3 inline-flex items-center text-[14px] font-bold text-paper no-underline">
            View shop
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="min-h-11 px-3 text-[14px] font-bold text-on-ink-muted bg-transparent border-0 cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>

      <main
        id="admin-main"
        className="flex-1 min-w-0 px-4 sm:px-[clamp(16px,3vw,40px)] pt-6 nav:pt-8 pb-[calc(96px+env(safe-area-inset-bottom))] nav:pb-16 flex flex-col gap-6"
      >
        <Suspense fallback={<div className="text-muted" role="status">Loading...</div>}>
          <Outlet />
        </Suspense>
      </main>

      {/* Phone bottom tab bar */}
      <nav
        aria-label="Admin"
        className="nav:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-line grid grid-cols-4 pb-[env(safe-area-inset-bottom)]"
      >
        {TABS.map(({ to, label, icon: Icon, end, add }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-h-16 text-[12px] font-bold no-underline ${
                isActive ? 'text-ink' : 'text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {add ? (
                  <span className="w-9 h-9 rounded-full bg-ink text-paper grid place-items-center">
                    <Icon size={20} />
                  </span>
                ) : (
                  <span className={`relative px-4 py-1 rounded-full ${isActive ? 'bg-blush' : ''}`}>
                    <Icon size={20} />
                    {to === '/admin/orders' && <NewBadge />}
                  </span>
                )}
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom'
import AnnouncementBar from './components/AnnouncementBar'
import Header from './components/Header'
import Footer from './components/Footer'
import Toast from './components/Toast'
import Button from './components/Button'
import Home from './pages/Home'
import Shop from './pages/Shop'
import Product from './pages/Product'
import BagDrawer from './components/BagDrawer'

// Checkout and the order page load on demand (Paystack's script only when paying)
const Checkout = lazy(() => import('./pages/Checkout'))
const Order = lazy(() => import('./pages/Order'))
import { useSettingsStore } from './stores/useSettingsStore'

// The admin is loaded only when someone opens /admin, so shoppers never download it.
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const RequireAdmin = lazy(() => import('./admin/AdminLayout').then((m) => ({ default: m.RequireAdmin })))
const AdminLogin = lazy(() => import('./admin/pages/Login'))
const AdminReset = lazy(() => import('./admin/pages/ResetPassword'))
const AdminProducts = lazy(() => import('./admin/pages/Products'))
const AdminProductForm = lazy(() => import('./admin/pages/ProductForm'))
const AdminImportReview = lazy(() => import('./admin/pages/ImportReview'))
const AdminOverview = lazy(() => import('./admin/pages/Overview'))
const AdminOrders = lazy(() => import('./admin/pages/Orders'))
const AdminOrderDetail = lazy(() => import('./admin/pages/OrderDetail'))
const AdminSettings = lazy(() => import('./admin/pages/Settings'))
const AdminNotFound = lazy(() => import('./admin/pages/NotFound'))

function Lazy({ children }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center bg-shell text-muted" role="status">
          Loading...
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

// Scroll to top on page change, or to #section when the link has a hash.
function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 50)
      return () => clearTimeout(t)
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

function ShopLayout() {
  const loadSettings = useSettingsStore((s) => s.load)
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-ink focus:text-paper focus:px-4 focus:py-3 focus:rounded-full"
      >
        Skip to content
      </a>
      <AnnouncementBar />
      <Header />
      <main id="main" className="flex-1">
        <Suspense fallback={<div className="container-shop py-20 text-muted" role="status">Loading...</div>}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <BagDrawer />
      <Toast />
    </div>
  )
}

function NotFound() {
  return (
    <section className="container-shop py-24 flex flex-col gap-6 items-start">
      <h1 className="m-0 font-display font-normal text-section">We could not find that page.</h1>
      <p className="m-0 text-muted">The link may be old. Everything we sell is in the shop.</p>
      <Button to="/shop">Shop all</Button>
    </section>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/admin/login" element={<Lazy><AdminLogin /></Lazy>} />
        <Route path="/admin/reset" element={<Lazy><AdminReset /></Lazy>} />
        <Route
          path="/admin"
          element={
            <Lazy>
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            </Lazy>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/:id" element={<AdminProductForm />} />
          <Route path="import/review" element={<AdminImportReview />} />
          <Route path="*" element={<AdminNotFound />} />
        </Route>
        <Route element={<ShopLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/:category" element={<Shop />} />
          <Route path="/product/:slug" element={<Product />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:reference" element={<Order />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

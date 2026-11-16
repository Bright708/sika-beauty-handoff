// Single entry point for shop data.
//   VITE_API_URL not set      -> in-browser seed data (no backend needed)
//   VITE_API_URL=/            -> same origin; in dev Vite proxies /api to the Express server
//   VITE_API_URL=https://...  -> that API (production)
import * as seed from '../data/seedApi'

const RAW = import.meta.env.VITE_API_URL
export const API = RAW ? RAW.replace(/\/+$/, '') : null // "/" becomes "" (same origin)

async function get(path, params) {
  const qs = params
    ? '?' +
      new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== false && v !== ''),
      )
    : ''
  let res
  try {
    res = await fetch(`${API}${path}${qs}`)
  } catch {
    throw Object.assign(new Error('We could not reach the shop. Check your connection and try again.'), { status: 0 })
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(body.message || 'Something went wrong. Please try again.'), { status: res.status })
  }
  return res.json()
}

async function post(path, body) {
  let res
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw Object.assign(new Error('We could not reach the shop. Check your connection and try again.'), { status: 0 })
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error(json.message || 'Something went wrong. Please try again.'), {
      status: res.status,
      errors: json.errors,
      stock_issues: json.stock_issues,
    })
  }
  return json
}

// Checkout needs the real server (Paystack keys live there).
export const checkoutAvailable = API !== null

export const getProducts = (params) => (API !== null ? get('/api/products', params) : seed.getProducts(params))
export const getProduct = (slug) => (API !== null ? get(`/api/products/${encodeURIComponent(slug)}`) : seed.getProduct(slug))
export const getSettings = () => (API !== null ? get('/api/settings') : seed.getSettings())
export const getCategories = () => (API !== null ? get('/api/categories') : seed.getCategories())
export const getVariants = (ids) =>
  !ids.length ? Promise.resolve([]) : API !== null ? get('/api/variants', { ids: ids.join(',') }) : seed.getVariants(ids)
export const initializeCheckout = (body) => post('/api/checkout/initialize', body)
export const verifyOrder = (reference) => get(`/api/checkout/verify/${encodeURIComponent(reference)}`)
export const retryOrder = (reference) => post(`/api/checkout/retry/${encodeURIComponent(reference)}`)

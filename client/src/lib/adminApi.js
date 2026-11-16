import { supabase } from './supabase'
import { API } from './api'

// Calls /api/admin/* with the signed-in admin's Supabase token.
// Errors carry a friendly .message, the HTTP .status and, for forms, .errors (field -> message).
export const adminReady = Boolean(supabase) && API !== null

export async function adminFetch(path, { method = 'GET', body } = {}) {
  if (!adminReady) throw new Error('The admin is not connected yet. Check the .env settings.')
  const { data } = await supabase.auth.getSession() // refreshes the token when needed
  const token = data.session?.access_token
  if (!token) throw Object.assign(new Error('Please sign in again.'), { status: 401 })

  let res
  try {
    res = await fetch(`${API}/api/admin${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw Object.assign(new Error('We could not reach the shop server. Check your connection and try again.'), {
      status: 0,
    })
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) {
      // Session ended: the guard sends the admin back to the sign-in page.
      const { useAuthStore } = await import('../stores/useAuthStore')
      useAuthStore.getState().signOut()
    }
    throw Object.assign(new Error(json.message || 'Something went wrong. Please try again.'), {
      status: res.status,
      errors: json.errors,
    })
  }
  return json
}

// Shared by the file helpers below
async function authedFetch(path, init = {}) {
  if (!adminReady) throw new Error('The admin is not connected yet. Check the .env settings.')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw Object.assign(new Error('Please sign in again.'), { status: 401 })
  let res
  try {
    res = await fetch(`${API}/api/admin${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
  } catch {
    throw Object.assign(new Error('We could not reach the shop server. Check your connection and try again.'), { status: 0 })
  }
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    if (res.status === 401) {
      const { useAuthStore } = await import('../stores/useAuthStore')
      useAuthStore.getState().signOut()
    }
    throw Object.assign(new Error(json.message || 'Something went wrong. Please try again.'), { status: res.status })
  }
  return res
}

// Download a file (e.g. the import template) and hand it to the browser.
export async function adminDownload(path, filename) {
  const blob = await (await authedFetch(path)).blob()
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// Send a file as the request body. Returns the JSON reply.
export async function adminUpload(path, file) {
  const res = await authedFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  })
  return res.json()
}

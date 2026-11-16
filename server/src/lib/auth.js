import { db } from './supabase.js'
import { HttpError, check } from './http.js'

// Admin guard: a valid Supabase session token (Authorization: Bearer <access_token>)
// whose user is listed in public.admins. Results are cached for a minute per token
// so a busy admin screen does not hit Supabase Auth on every request.
const cache = new Map() // token -> { user, expires }
const TTL_MS = 60_000

export async function requireAdmin(req, _res, next) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new HttpError(401, 'Please sign in to continue.')

  const hit = cache.get(token)
  if (hit && hit.expires > Date.now()) {
    req.admin = hit.user
    return next()
  }

  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user) {
    cache.delete(token)
    throw new HttpError(401, 'Your session has ended. Please sign in again.')
  }

  const row = check(
    await db.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle(),
    'admins',
  )
  if (!row) throw new HttpError(403, 'This account cannot use the shop admin.')

  const user = { id: data.user.id, email: data.user.email }
  if (cache.size > 500) cache.clear()
  cache.set(token, { user, expires: Date.now() + TTL_MS })
  req.admin = user
  next()
}

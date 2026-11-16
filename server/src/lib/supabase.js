import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy server/.env.example to server/.env and fill it in.')
  process.exit(1)
}

// Service role client: bypasses RLS. Server only, never sent to the browser.
export const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

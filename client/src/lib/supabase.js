import { createClient } from '@supabase/supabase-js'

// Browser Supabase client. Uses the public anon key only (safe to ship).
// It is used for admin sign-in and for uploading photos to signed URLs from our server.
// All data writes go through the Express API, never straight to the database.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null

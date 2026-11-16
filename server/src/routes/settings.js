import { Router } from 'express'
import { db } from '../lib/supabase.js'
import { check } from '../lib/http.js'

const router = Router()

// GET /api/settings: shop info + delivery zones (public)
router.get('/settings', async (_req, res) => {
  const [settings, zones] = await Promise.all([
    db
      .from('settings')
      .select('shop_name, whatsapp, pickup_address, pickup_hours, cutoff_time, free_delivery_threshold_ghs')
      .eq('id', true)
      .maybeSingle(),
    db.from('delivery_zones').select('id, name, fee_ghs, sort').order('sort').order('id'),
  ])
  res.set('Cache-Control', 'public, max-age=60')
  res.json({ ...(check(settings, 'settings') || {}), delivery_zones: check(zones, 'zones') })
})

// GET /api/categories (public)
router.get('/categories', async (_req, res) => {
  const data = check(await db.from('categories').select('id, name, slug, sort').order('sort'), 'categories')
  res.set('Cache-Control', 'public, max-age=300')
  res.json(data)
})

export default router

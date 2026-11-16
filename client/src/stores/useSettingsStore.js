import { create } from 'zustand'
import { getSettings } from '../lib/api'
import { SHOP } from '../config/shop'

// Shop settings (WhatsApp, cut-off time, zones...). Starts from config/shop.js defaults,
// then values saved by the owner in admin Settings override them once loaded.
export const useSettingsStore = create((set, get) => ({
  settings: {
    shop_name: SHOP.name,
    whatsapp: SHOP.whatsapp,
    cutoff_time: SHOP.cutoffTime,
    pickup_address: '',
    pickup_hours: '',
    free_delivery_threshold_ghs: null,
    delivery_zones: [],
  },
  loaded: false,
  load: async () => {
    if (get().loaded) return
    try {
      const s = await getSettings()
      set({ settings: { ...get().settings, ...s }, loaded: true })
    } catch {
      // Keep the defaults; the shop still works.
    }
  },
}))

import { create } from 'zustand'
import { adminFetch } from '../lib/adminApi'

// Order counts for the sidebar badge ("Orders 3"). Refreshed by the layout every minute
// and by the order pages after a change.
export const useAdminCounts = create((set) => ({
  counts: null,
  refresh: async () => {
    try {
      set({ counts: await adminFetch('/orders/counts') })
    } catch {
      // The badge is a nice-to-have; pages show their own errors.
    }
  },
  setCounts: (counts) => set({ counts }),
}))

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Bag holds variant ids + quantities only. Never prices: the server recomputes everything.
// Phase 1 only needs the count for the header; the drawer UI arrives in phase 6.
export const useBagStore = create(
  persist(
    (set, get) => ({
      items: [], // [{ variantId, qty }]
      isOpen: false,

      // max = stock known at the time (the server re-checks at checkout)
      add: (variantId, qty = 1, max = Infinity) =>
        set((s) => {
          const existing = s.items.find((i) => i.variantId === variantId)
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.variantId === variantId ? { ...i, qty: Math.min(i.qty + qty, max) } : i,
              ),
            }
          }
          return { items: [...s.items, { variantId, qty: Math.min(qty, max) }] }
        }),
      remove: (variantId) =>
        set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      setQty: (variantId, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.variantId !== variantId)
              : s.items.map((i) => (i.variantId === variantId ? { ...i, qty } : i)),
        })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.qty, 0),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: 'sika-bag',
      partialize: (s) => ({ items: s.items }), // drawer state is not persisted
    },
  ),
)

export const useBagCount = () =>
  useBagStore((s) => s.items.reduce((n, i) => n + i.qty, 0))

import { create } from 'zustand'

let timer
export const useToastStore = create((set) => ({
  toast: null, // { message, action?: { label, onClick } }
  show: (toast) => {
    clearTimeout(timer)
    set({ toast: { ...toast, key: Date.now() } })
    timer = setTimeout(() => set({ toast: null }), 4000)
  },
  hide: () => {
    clearTimeout(timer)
    set({ toast: null })
  },
}))

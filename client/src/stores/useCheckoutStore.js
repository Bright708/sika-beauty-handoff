import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Checkout form + payment status.
// The contact and delivery details are remembered on this device so returning customers
// do not type them again. Nothing about payment is stored.
const EMPTY = {
  customer_name: '',
  phone: '+233 ',
  email: '',
  fulfilment: 'delivery', // delivery | pickup
  delivery_zone_id: '',
  area: '',
  gps_address: '',
  notes: '',
  is_gift: false,
  gift_message: '',
}

export const useCheckoutStore = create(
  persist(
    (set) => ({
      form: EMPTY,
      status: 'idle', // idle | starting | paying | done
      lastReference: null,
      setField: (key, value) => set((s) => ({ form: { ...s.form, [key]: value } })),
      setStatus: (status) => set({ status }),
      setLastReference: (lastReference) => set({ lastReference }),
      // After a paid order: keep contact + address, forget the one-off bits
      resetAfterOrder: () => set((s) => ({ form: { ...s.form, notes: '', is_gift: false, gift_message: '' }, status: 'idle' })),
    }),
    {
      name: 'sika-checkout',
      partialize: (s) => ({ form: s.form, lastReference: s.lastReference }),
    },
  ),
)

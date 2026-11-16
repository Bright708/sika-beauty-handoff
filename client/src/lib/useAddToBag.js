import { useBagStore } from '../stores/useBagStore'
import { useToastStore } from '../stores/useToastStore'

// Adds a variant and shows "Added to your bag · View bag".
export function useAddToBag() {
  const add = useBagStore((s) => s.add)
  const open = useBagStore((s) => s.open)
  const show = useToastStore((s) => s.show)
  return (variant, qty = 1, { toast = true } = {}) => {
    add(variant.id, qty, variant.stock)
    if (toast) show({ message: 'Added to your bag', action: { label: 'View bag', onClick: open } })
  }
}

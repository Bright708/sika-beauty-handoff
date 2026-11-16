import { useEffect, useMemo, useState } from 'react'
import { getVariants } from './api'
import { effectivePrice } from './catalog'
import { useBagStore } from '../stores/useBagStore'

// The bag stores only { variantId, qty }. This loads current names, prices and stock
// for display. The server still recomputes every price at checkout.
// Quantities above the current stock are lowered automatically.
export function useBagLines(active = true) {
  const items = useBagStore((s) => s.items)
  const setQty = useBagStore((s) => s.setQty)
  const idsKey = useMemo(() => items.map((i) => i.variantId).sort().join(','), [items])
  const [state, setState] = useState({ key: null, variants: null, error: '' })
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!active) return
    let alive = true
    const ids = idsKey ? idsKey.split(',') : []
    getVariants(ids)
      .then((list) => alive && setState({ key: idsKey, variants: new Map(list.map((v) => [v.id, v])), error: '' }))
      .catch((err) => alive && setState((s) => ({ ...s, key: idsKey, error: err.message })))
    return () => {
      alive = false
    }
  }, [idsKey, active, reload])

  const variants = state.variants
  const ready = variants !== null && state.key === idsKey

  // Keep quantities within stock
  useEffect(() => {
    if (!ready) return
    for (const it of items) {
      const v = variants.get(it.variantId)
      if (v && v.stock > 0 && it.qty > v.stock) setQty(it.variantId, v.stock)
    }
  }, [ready, variants, items, setQty])

  const lines = items.map((it) => ({ ...it, variant: ready ? variants.get(it.variantId) || null : undefined }))
  const available = lines.filter((l) => l.variant && l.variant.stock > 0)
  const subtotal = available.reduce((n, l) => n + effectivePrice(l.variant) * l.qty, 0)
  const hasProblems = ready && lines.some((l) => !l.variant || l.variant.stock <= 0)

  return {
    lines,
    loading: !ready && !state.error,
    error: state.error,
    subtotal,
    hasProblems,
    refresh: () => setReload((n) => n + 1),
  }
}

// Same product rules as client/src/lib/catalog.js. Keep the two in step.

export const effectivePrice = (v) => (v.sale_price_ghs != null ? v.sale_price_ghs : v.price_ghs)
export const isOnSale = (v) => v.sale_price_ghs != null && v.sale_price_ghs < v.price_ghs
export const inStock = (p) => p.variants.some((v) => v.stock > 0)
export const productOnSale = (p) => p.variants.some(isOnSale)

export function defaultVariant(p) {
  const vs = p.variants
  return vs.find((v) => v.stock > 0 && isOnSale(v)) || vs.find((v) => v.stock > 0) || vs[0]
}

// Columns returned to the shop. Nested variants, images and category in one query.
export const PUBLIC_PRODUCT_SELECT = `
  id, slug, name, brand, description, notes_top, notes_heart, notes_base, status, created_at,
  category:categories ( id, name, slug ),
  variants:product_variants ( id, size_label, price_ghs, sale_price_ghs, stock, sort ),
  images:product_images ( storage_path, sort )
`

// Sort nested rows and drop internal fields
export function shapeProduct(p) {
  return {
    ...p,
    variants: [...(p.variants || [])].sort((a, b) => a.sort - b.sort).map(({ sort, ...v }) => v),
    images: [...(p.images || [])].sort((a, b) => a.sort - b.sort),
  }
}

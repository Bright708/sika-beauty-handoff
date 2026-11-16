// Shared product helpers. The server (phase 3) uses the same rules.

export const TINTS = ['bg-peach', 'bg-sand', 'bg-lilac', 'bg-sage']
export const tintFor = (i) => TINTS[((i % TINTS.length) + TINTS.length) % TINTS.length]

// "Collections" group several categories under one link (e.g. "Body creams" in the nav).
// A /shop/:category URL can be a collection slug or a single category slug.
export const COLLECTIONS = {
  'body-creams': {
    name: 'Body creams',
    categories: ['body-cream', 'body-butter', 'body-oil', 'body-mist'],
  },
}

export const effectivePrice = (v) => (v.sale_price_ghs != null ? v.sale_price_ghs : v.price_ghs)
export const isOnSale = (v) => v.sale_price_ghs != null && v.sale_price_ghs < v.price_ghs
export const percentOff = (v) => Math.round(((v.price_ghs - v.sale_price_ghs) / v.price_ghs) * 100)
export const inStock = (p) => p.variants.some((v) => v.stock > 0)
export const productOnSale = (p) => p.variants.some(isOnSale)

// The size shown on cards and pre-selected on the product page:
// an in-stock size on sale, else the first in-stock size, else the first size.
export function defaultVariant(p) {
  const vs = p.variants
  return vs.find((v) => v.stock > 0 && isOnSale(v)) || vs.find((v) => v.stock > 0) || vs[0]
}

export const isPerfume = (p) => p.category?.slug === 'perfume'
export const isBodyCare = (p) => COLLECTIONS['body-creams'].categories.includes(p.category?.slug)

// Low stock: 1 to 3 left
export const lowStock = (v) => v.stock > 0 && v.stock <= 3

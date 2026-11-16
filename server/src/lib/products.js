import { db } from './supabase.js'
import { check } from './http.js'

// Shared by the add-product form and the spreadsheet import.

export const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'product'

export async function uniqueSlug(name) {
  const base = slugify(name)
  const taken = new Set(
    check(await db.from('products').select('slug').like('slug', `${base}%`), 'slugs').map((r) => r.slug),
  )
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

// Insert a product with its sizes and photos. Returns the new id.
// There are no multi-table transactions over REST, so if a child insert fails
// the half-made product is removed again.
export async function insertProduct({ product, variants, images = [] }) {
  const slug = await uniqueSlug(product.name)
  const created = check(await db.from('products').insert({ ...product, slug }).select('id').single(), 'create product')
  try {
    check(
      await db
        .from('product_variants')
        .insert(variants.map(({ id: _id, ...v }, i) => ({ ...v, sort: i, product_id: created.id }))),
      'create variants',
    )
    if (images.length) {
      check(
        await db
          .from('product_images')
          .insert(images.map((storage_path, sort) => ({ product_id: created.id, storage_path, sort }))),
        'create images',
      )
    }
  } catch (err) {
    await db.from('products').delete().eq('id', created.id)
    throw err
  }
  return created.id
}

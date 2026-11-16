import { supabase } from './supabase'
import { adminFetch } from './adminApi'

// Phone photos can be 5 to 12 MB. Shrink big ones in the browser first so uploads are quick
// on mobile data. The server then makes the 480/960/1440 WebP copies the shop uses.
const MAX_EDGE = 2400
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const SMALL_ENOUGH = 1.5 * 1024 * 1024

async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
  if (scale === 1 && OK_TYPES.includes(file.type) && file.size <= SMALL_ENOUGH) {
    bmp.close?.()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob) throw new Error('shrink failed')
  return blob
}

async function prepare(file) {
  try {
    return await shrink(file)
  } catch {
    // The browser could not read it (for example some HEIC files). Send it as is if we can.
    if (OK_TYPES.includes(file.type) && file.size <= 10 * 1024 * 1024) return file
    throw new Error('We could not read that photo. Try a JPG or PNG, or take the photo again.')
  }
}

// Returns the stored base path, e.g. "products/<uuid>".
export async function uploadPhoto(file) {
  const blob = await prepare(file)
  const contentType = OK_TYPES.includes(blob.type) ? blob.type : 'image/jpeg'
  const { path, token } = await adminFetch('/uploads', { method: 'POST', body: { content_type: contentType } })
  const { error } = await supabase.storage.from('product-images').uploadToSignedUrl(path, token, blob, { contentType })
  if (error) throw new Error('The upload did not finish. Check your connection and try again.')
  const { storage_path } = await adminFetch('/uploads/process', { method: 'POST', body: { path } })
  return storage_path
}

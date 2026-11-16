import { randomUUID } from 'node:crypto'
import dns from 'node:dns/promises'
import net from 'node:net'
import sharp from 'sharp'
import { db } from './supabase.js'
import { HttpError, badRequest } from './http.js'

// Photo pipeline
// 1. The admin asks for a signed upload URL (uploads/<uuid>.<ext>) and uploads the photo
//    straight to Supabase Storage. The bucket has no upload policies, so this signed URL
//    is the only way in.
// 2. The admin asks us to process it: we download it, make WebP copies 480/960/1440 wide,
//    store them as products/<uuid>-<width>.webp and delete the original.
//    The product keeps the base path "products/<uuid>".

export const BUCKET = 'product-images'
export const WIDTHS = [480, 960, 1440]
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const UPLOAD_PATH = /^uploads\/[0-9a-f-]{36}\.(jpg|png|webp)$/
export const STORED_PATH = /^products\/[0-9a-f-]{36}$/

sharp.cache(false) // keep memory low on small servers
sharp.concurrency(1)

const storage = () => db.storage.from(BUCKET)

export async function createUploadUrl(contentType) {
  const ext = EXT[contentType]
  if (!ext) throw badRequest('Please choose a JPG, PNG or WebP photo.')
  const path = `uploads/${randomUUID()}.${ext}`
  const { data, error } = await storage().createSignedUploadUrl(path)
  if (error) {
    console.error('[storage] signed upload url', error)
    throw new HttpError(500, 'We could not start the upload. Please try again.')
  }
  return { path: data.path, token: data.token, signed_url: data.signedUrl }
}

export async function processUpload(path) {
  if (!UPLOAD_PATH.test(path || '')) throw badRequest('That upload was not recognised. Please add the photo again.')

  const { data: blob, error } = await storage().download(path)
  if (error || !blob) {
    console.error('[storage] download', error)
    throw badRequest('We could not find that photo. Please add it again.')
  }
  const input = Buffer.from(await blob.arrayBuffer())
  try {
    return await storeImageBuffer(input)
  } finally {
    await storage().remove([path])
  }
}

// Make the 480/960/1440 WebP copies of a photo and store them. Returns { storage_path }.
export async function storeImageBuffer(input) {
  let meta
  try {
    meta = await sharp(input).metadata()
  } catch {
    throw badRequest('That file is not a photo we can use. Please try a JPG or PNG.')
  }
  if (!meta.width || !meta.height) throw badRequest('That file is not a photo we can use.')

  const base = `products/${randomUUID()}`
  for (const width of WIDTHS) {
    const out = await sharp(input, { limitInputPixels: 80_000_000 })
      .rotate() // respect the phone's EXIF orientation
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: width <= 480 ? 78 : 80 })
      .toBuffer()
    const up = await storage().upload(`${base}-${width}.webp`, out, {
      contentType: 'image/webp',
      cacheControl: '31536000', // file names never change, so cache for a year
      upsert: false,
    })
    if (up.error) {
      console.error('[storage] upload resized', up.error)
      await removeStored([base])
      throw new HttpError(500, 'We could not save that photo. Please try again.')
    }
  }
  return { storage_path: base }
}

// ---------- photo links from the spreadsheet import ----------

// Share links that open a web page instead of the photo itself.
export function directImageUrl(url) {
  const u = new URL(url)
  if (u.hostname === 'drive.google.com') {
    const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || u.searchParams.get('id')
    if (id) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`
  }
  if (/(^|\.)dropbox\.com$/.test(u.hostname)) {
    u.searchParams.delete('dl')
    u.searchParams.set('raw', '1')
    return u.toString()
  }
  return u.toString()
}

// Block links that point inside the server's own network (cloud metadata, localhost, ...).
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
  }
  const v = ip.toLowerCase()
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7))
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
}

async function assertPublicUrl(url) {
  const u = new URL(url)
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('not http')
  const addrs = await dns.lookup(u.hostname, { all: true })
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('private address')
}

const MAX_DOWNLOAD = 15 * 1024 * 1024

// Download a photo from a link and store it. Throws an Error with a plain-words message.
export async function importImageFromUrl(link) {
  let url
  try {
    url = directImageUrl(link)
  } catch {
    throw new Error('the photo link is not a valid web address')
  }
  let res
  try {
    for (let hops = 0; ; hops++) {
      await assertPublicUrl(url)
      res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000), headers: { Accept: 'image/*' } })
      const next = res.status >= 300 && res.status < 400 && res.headers.get('location')
      if (!next) break
      if (hops >= 4) throw new Error('too many redirects')
      url = new URL(next, url).toString()
    }
  } catch {
    throw new Error('we could not open the photo link')
  }
  if (!res.ok) throw new Error(`the photo link did not work (error ${res.status})`)
  if (Number(res.headers.get('content-length')) > MAX_DOWNLOAD) throw new Error('the photo is larger than 15 MB')

  const chunks = []
  let size = 0
  for await (const chunk of res.body) {
    size += chunk.length
    if (size > MAX_DOWNLOAD) throw new Error('the photo is larger than 15 MB')
    chunks.push(chunk)
  }
  try {
    return (await storeImageBuffer(Buffer.concat(chunks))).storage_path
  } catch (err) {
    if (err.status === 400) throw new Error('the link did not lead to a photo (use a direct image link)')
    throw new Error('we could not save the photo')
  }
}

// Delete all sizes of the given stored base paths. Never throws: a leftover file is harmless.
export async function removeStored(basePaths) {
  const files = basePaths
    .filter((p) => STORED_PATH.test(p))
    .flatMap((p) => WIDTHS.map((w) => `${p}-${w}.webp`))
  if (!files.length) return
  const { error } = await storage().remove(files)
  if (error) console.error('[storage] remove', error)
}

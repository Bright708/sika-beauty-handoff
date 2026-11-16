import { useEffect, useRef, useState } from 'react'
import { uploadPhoto } from '../lib/photoUpload'
import { imageUrl } from '../lib/images'
import { CloseIcon, GripIcon, PhotoIcon } from './ui'

// Photos for one product. First photo = cover. Up to `max`.
// Each item: { key, status: 'queued' | 'uploading' | 'done' | 'error', storage_path?, preview?, file?, error? }
// Uploads run one at a time (kind to slow connections and to the server).
// Reorder: drag the grip (mouse or finger), or focus it and use the arrow keys.

let nextKey = 1
export const photoFromStored = (storage_path) => ({ key: `s${nextKey++}`, status: 'done', storage_path })

export default function PhotoManager({ photos, setPhotos, max = 6, error }) {
  const [dragKey, setDragKey] = useState(null)
  const [announce, setAnnounce] = useState('')
  const [note, setNote] = useState('')
  const running = useRef(false)
  const urls = useRef(new Set())
  const inputRef = useRef(null)

  // Free the local previews when leaving the page
  useEffect(() => {
    const set = urls.current
    return () => set.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  // Upload queue: whenever something is queued and nothing is running, upload the next one.
  useEffect(() => {
    if (running.current) return
    const item = photos.find((p) => p.status === 'queued')
    if (!item) return
    running.current = true
    const patch = (fields) => setPhotos((list) => list.map((p) => (p.key === item.key ? { ...p, ...fields } : p)))
    patch({ status: 'uploading', error: '' })
    uploadPhoto(item.file)
      .then((storage_path) => patch({ status: 'done', storage_path }))
      .catch((err) => patch({ status: 'error', error: err.message || 'Upload failed.' }))
      .finally(() => {
        running.current = false
        // nudge the effect to pick up the next queued photo
        setPhotos((list) => [...list])
      })
  }, [photos, setPhotos])

  function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    setNote('')
    if (!files.length) return
    const room = max - photos.length
    if (room <= 0) return setNote(`You already have ${max} photos. Remove one to add another.`)
    if (files.length > room) setNote(`Only ${room} more ${room === 1 ? 'photo fits' : 'photos fit'}, so we added the first ${room}.`)
    const items = files.slice(0, room).map((file) => {
      const preview = URL.createObjectURL(file)
      urls.current.add(preview)
      return { key: `n${nextKey++}`, status: 'queued', file, preview }
    })
    setPhotos((list) => [...list, ...items])
  }

  const move = (key, to) =>
    setPhotos((list) => {
      const from = list.findIndex((p) => p.key === key)
      if (from < 0 || to < 0 || to >= list.length || from === to) return list
      const next = [...list]
      const [it] = next.splice(from, 1)
      next.splice(to, 0, it)
      return next
    })

  const remove = (key) => {
    setPhotos((list) => list.filter((p) => p.key !== key))
    setAnnounce('Photo removed.')
  }
  const retry = (key) =>
    setPhotos((list) => list.map((p) => (p.key === key ? { ...p, status: 'queued', error: '' } : p)))

  // Pointer drag (works for touch and mouse)
  function onGripDown(e, key) {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDragKey(key)
  }
  function onGripMove(e) {
    if (!dragKey) return
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-photo-key]')
    if (!over || over.dataset.photoKey === dragKey) return
    const to = photos.findIndex((p) => p.key === over.dataset.photoKey)
    move(dragKey, to)
  }
  function onGripUp() {
    if (!dragKey) return
    const i = photos.findIndex((p) => p.key === dragKey)
    setAnnounce(`Photo moved to position ${i + 1} of ${photos.length}${i === 0 ? ', now the cover' : ''}.`)
    setDragKey(null)
  }
  function onGripKey(e, key, i) {
    const delta = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key]
    if (!delta) return
    e.preventDefault()
    const to = i + delta
    if (to < 0 || to >= photos.length) return
    move(key, to)
    setAnnounce(`Photo moved to position ${to + 1} of ${photos.length}${to === 0 ? ', now the cover' : ''}.`)
  }

  const full = photos.length >= max

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
        {!full && (
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              addFiles(e.dataTransfer.files)
            }}
            className="col-span-2 min-h-[200px] border-2 border-dashed border-dash rounded-tile flex flex-col items-center justify-center gap-2 text-center p-4 cursor-pointer bg-paper hover:border-rose focus-within:outline-2 focus-within:outline-rose focus-within:outline-offset-2"
          >
            <span className="text-rose">
              <PhotoIcon />
            </span>
            <span className="font-extrabold">Add photos</span>
            <span className="text-[13px] text-muted">Take a picture or choose from your phone</span>
            <span className="text-[12px] text-muted">
              {photos.length} of {max} added
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = '' // allow picking the same photo again
              }}
            />
          </label>
        )}

        {photos.map((p, i) => {
          const src = p.preview || (p.storage_path ? imageUrl(p.storage_path, 480) : null)
          const label = `Photo ${i + 1}${i === 0 ? ', cover' : ''}`
          return (
            <div
              key={p.key}
              data-photo-key={p.key}
              className={`relative aspect-square rounded-tile overflow-hidden bg-peach select-none ${
                dragKey === p.key ? 'ring-2 ring-rose ring-offset-2 ring-offset-white z-10' : ''
              }`}
            >
              {src && <img src={src} alt={label} draggable={false} className="absolute inset-0 w-full h-full object-cover" />}

              {(p.status === 'uploading' || p.status === 'queued') && (
                <div className="absolute inset-0 bg-ink/45 grid place-items-center text-paper text-[13px] font-bold" role="status">
                  {p.status === 'uploading' ? 'Uploading...' : 'Waiting...'}
                </div>
              )}
              {p.status === 'error' && (
                <div className="absolute inset-0 bg-ink/75 flex flex-col items-center justify-center gap-2 p-2 text-center" role="alert">
                  <span className="text-paper text-[12px] font-bold leading-snug">{p.error}</span>
                  <button
                    type="button"
                    onClick={() => retry(p.key)}
                    className="min-h-11 px-4 rounded-full bg-paper text-ink text-[13px] font-bold border-0 cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              )}

              {i === 0 && (
                <span className="absolute left-2 bottom-2 px-2.5 py-[3px] bg-ink text-paper rounded-full text-[11px] font-extrabold pointer-events-none">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(p.key)}
                aria-label={`Remove ${label.toLowerCase()}`}
                className="absolute top-1 right-1 w-11 h-11 grid place-items-center bg-transparent border-0 cursor-pointer"
              >
                <span className="w-8 h-8 rounded-full bg-white/95 text-ink grid place-items-center">
                  <CloseIcon size={16} />
                </span>
              </button>
              {photos.length > 1 && (
                <button
                  type="button"
                  aria-label={`Move ${label.toLowerCase()}. Drag, or use the arrow keys.`}
                  onPointerDown={(e) => onGripDown(e, p.key)}
                  onPointerMove={onGripMove}
                  onPointerUp={onGripUp}
                  onPointerCancel={onGripUp}
                  onKeyDown={(e) => onGripKey(e, p.key, i)}
                  className="absolute bottom-1 right-1 w-11 h-11 grid place-items-center bg-transparent border-0 cursor-grab active:cursor-grabbing touch-none"
                >
                  <span className="w-8 h-8 rounded-full bg-white/95 text-ink grid place-items-center">
                    <GripIcon size={16} />
                  </span>
                </button>
              )}
            </div>
          )
        })}
      </div>
      {full && <span className="text-[14px] text-muted">{max} of {max} photos. Remove one to add another.</span>}
      {note && <span className="text-[14px] font-bold text-rose">{note}</span>}
      {error && <span className="text-[14px] font-bold text-rose">{error}</span>}
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  )
}

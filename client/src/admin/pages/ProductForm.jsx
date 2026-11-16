import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { adminFetch } from '../../lib/adminApi'
import { getCategories } from '../../lib/api'
import { defaultVariant, effectivePrice, isOnSale, percentOff } from '../../lib/catalog'
import { formatGHS } from '../../lib/format'
import { imageUrl } from '../../lib/images'
import { buttonClass } from '../../components/Button'
import PhotoManager, { photoFromStored } from '../PhotoManager'
import { Card, ConfirmDialog, Field, Notice, inputClass, useDocTitle, PlusIcon } from '../ui'

let rowKey = 1
const emptySize = () => ({ key: rowKey++, id: null, size_label: '', price_ghs: '', sale_price_ghs: '', stock: '' })
const EMPTY = {
  name: '',
  category_id: '',
  brand: '',
  description: '',
  notes_top: '',
  notes_heart: '',
  notes_base: '',
  status: 'live',
}

const toForm = (p) => ({
  form: {
    name: p.name || '',
    category_id: String(p.category_id ?? ''),
    brand: p.brand || '',
    description: p.description || '',
    notes_top: p.notes_top || '',
    notes_heart: p.notes_heart || '',
    notes_base: p.notes_base || '',
    status: p.status,
  },
  sizes: p.variants.length
    ? p.variants.map((v) => ({
        key: rowKey++,
        id: v.id,
        size_label: v.size_label,
        price_ghs: String(v.price_ghs),
        sale_price_ghs: v.sale_price_ghs == null ? '' : String(v.sale_price_ghs),
        stock: String(v.stock),
      }))
    : [emptySize()],
  photos: p.images.map((i) => photoFromStored(i.storage_path)),
})

const num = (s) => {
  const n = Number(String(s).replace(/[,\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}
const savedText = (status) =>
  status === 'live' ? 'Published. It is now in your shop.' : 'Saved as a draft. Shoppers cannot see it yet.'

// Text input that only brings up the number keypad on phones and accepts "1,050".
const numberProps = { type: 'text', inputMode: 'numeric', autoComplete: 'off' }

function ProductForm() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const location = useLocation()
  useDocTitle(isNew ? 'Add a product' : 'Edit product')

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState('')
  const [product, setProduct] = useState(null) // saved copy (edit mode)
  const [form, setForm] = useState(EMPTY)
  const [sizes, setSizes] = useState(() => [emptySize()])
  const [photos, setPhotos] = useState([])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(location.state?.saved || '')
  const [formError, setFormError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const formRef = useRef(null)

  useEffect(() => {
    getCategories()
      .then((cats) => {
        setCategories(cats)
        setForm((f) => (f.category_id ? f : { ...f, category_id: String(cats[0]?.id ?? '') }))
      })
      .catch(() => setLoadError('We could not load the categories. Check your connection and refresh.'))
  }, [])

  // Load once per product. A response that arrives after the effect is cleaned up
  // (React dev runs effects twice, or the admin moved on) is ignored, so a late reply
  // can never overwrite what the admin has already typed.
  useEffect(() => {
    if (isNew) return
    let alive = true
    setLoadError('')
    adminFetch(`/products/${id}`)
      .then((p) => {
        if (!alive) return
        const f = toForm(p)
        setProduct(p)
        setForm(f.form)
        setSizes(f.sizes)
        setPhotos(f.photos)
      })
      .catch((err) => alive && setLoadError(err.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id, isNew])

  // Clear the "saved" note as soon as something changes
  const touch = (key) => {
    setSaved('')
    setFormError('')
    if (key && errors[key]) setErrors(({ [key]: _gone, ...rest }) => rest)
  }
  const setField = (key) => (e) => {
    touch(key)
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }
  const setSize = (i, key) => (e) => {
    touch(`variants.${i}.${key}`)
    const value = e.target.value
    setSizes((list) => list.map((s, j) => (j === i ? { ...s, [key]: value } : s)))
  }
  const addSize = () => {
    touch()
    setSizes((list) => [...list, emptySize()])
  }
  const removeSize = (i) => {
    touch()
    setErrors({}) // row positions changed
    setSizes((list) => list.filter((_, j) => j !== i))
  }
  const updatePhotos = useCallback((fn) => {
    setSaved('')
    setPhotos(fn)
  }, [])

  const category = categories.find((c) => String(c.id) === String(form.category_id))
  const perfume = category?.slug === 'perfume'

  // Card preview uses the same rules as the shop card
  const preview = useMemo(() => {
    const variants = sizes
      .map((s) => ({
        size_label: s.size_label.trim(),
        price_ghs: num(s.price_ghs),
        sale_price_ghs: num(s.sale_price_ghs),
        stock: s.stock === '' ? 0 : Number(s.stock) || 0,
      }))
      .filter((v) => v.price_ghs)
      .map((v) => ({ ...v, sale_price_ghs: v.sale_price_ghs && v.sale_price_ghs < v.price_ghs ? v.sale_price_ghs : null }))
    const v = variants.length ? defaultVariant({ variants }) : null
    return { v, sale: v ? isOnSale(v) : false }
  }, [sizes])
  const cover = photos[0]
  const coverSrc = cover ? cover.preview || (cover.storage_path ? imageUrl(cover.storage_path, 480) : null) : null

  async function onSave(e) {
    e.preventDefault()
    setFormError('')
    setSaved('')
    if (photos.some((p) => p.status === 'uploading' || p.status === 'queued')) {
      return setFormError('Please wait for the photos to finish uploading.')
    }
    if (photos.some((p) => p.status === 'error')) {
      return setFormError('A photo did not upload. Tap "Try again" on it, or remove it.')
    }
    const body = {
      ...form,
      category_id: Number(form.category_id),
      variants: sizes.map(({ id: vid, size_label, price_ghs, sale_price_ghs, stock }) => ({
        id: vid,
        size_label,
        price_ghs,
        sale_price_ghs,
        stock,
      })),
      images: photos.map((p) => p.storage_path),
    }
    setSaving(true)
    try {
      const p = await adminFetch(isNew ? '/products' : `/products/${id}`, { method: isNew ? 'POST' : 'PUT', body })
      setErrors({})
      if (isNew) {
        navigate(`/admin/products/${p.id}`, { replace: true, state: { saved: savedText(p.status) } })
      } else {
        const f = toForm(p)
        setProduct(p)
        setSizes(f.sizes)
        setSaved(savedText(p.status))
      }
    } catch (err) {
      if (err.errors) {
        setErrors(err.errors)
        setFormError(err.message)
        // Move focus to the first field that needs fixing
        requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
      } else {
        setFormError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    setDeleting(true)
    try {
      await adminFetch(`/products/${id}`, { method: 'DELETE' })
      navigate('/admin/products', { replace: true, state: { message: `${product?.name || 'Product'} was deleted.` } })
    } catch (err) {
      setConfirmDelete(false)
      setFormError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-admin p-6 text-muted" role="status">
        Loading the product...
      </div>
    )
  }
  if (loadError && !isNew && !product) {
    return (
      <div className="bg-white rounded-admin p-6 flex flex-col gap-3 items-start">
        <Notice tone="danger">{loadError}</Notice>
        <Link to="/admin/products" className={buttonClass({ variant: 'secondary', size: 'md' })}>
          Back to products
        </Link>
      </div>
    )
  }

  const live = form.status === 'live'
  const saveLabel = saving ? 'Saving...' : isNew ? (live ? 'Publish product' : 'Save draft') : 'Save changes'
  const sizesError = errors.variants

  return (
    <form ref={formRef} onSubmit={onSave} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <nav aria-label="Breadcrumb" className="flex gap-2 text-[14px] text-muted">
          <Link to="/admin/products" className="text-muted">
            Products
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{isNew ? 'Add product' : product?.name}</span>
        </nav>
        <h1 className="m-0 font-display font-normal text-[40px] leading-[1.1]">{isNew ? 'Add a product' : 'Edit product'}</h1>
      </div>
      {loadError && <Notice tone="danger">{loadError}</Notice>}

      <div className="flex flex-wrap gap-6 items-start">
        <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-5">
          <Card title="Photos" subtitle="The first photo is the one shoppers see first. Square photos look best.">
            <PhotoManager photos={photos} setPhotos={updatePhotos} error={errors.images} />
          </Card>

          <Card title="About the product">
            <Field label="Product name" error={errors.name}>
              {(a) => (
                <input {...a} type="text" value={form.name} onChange={setField('name')} placeholder="e.g. Oud Noir" maxLength={120} className={inputClass} />
              )}
            </Field>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4">
              <Field label="Category" error={errors.category_id}>
                {(a) => (
                  <select {...a} value={form.category_id} onChange={setField('category_id')} className={`${inputClass} px-3.5`}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Brand" optional>
                {(a) => (
                  <input {...a} type="text" value={form.brand} onChange={setField('brand')} placeholder="e.g. Lattafa" maxLength={80} className={inputClass} />
                )}
              </Field>
            </div>
            <Field label="Short description">
              {(a) => (
                <textarea
                  {...a}
                  rows={3}
                  value={form.description}
                  onChange={setField('description')}
                  placeholder="What does it smell or feel like? Who is it for?"
                  maxLength={2000}
                  className={`${inputClass} py-3.5 resize-y`}
                />
              )}
            </Field>
          </Card>

          <Card title="Sizes, prices and stock" subtitle="One row per size. Leave sale price empty if it's not on sale.">
            {sizes.map((s, i) => {
              const err = (k) => errors[`variants.${i}.${k}`]
              return (
                <fieldset
                  key={s.key}
                  className="m-0 p-0 border-0 pb-4 border-b border-line-soft grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3 items-start"
                >
                  <legend className="sr-only">Size {i + 1}</legend>
                  <Field small label="Size" error={err('size_label')}>
                    {(a) => (
                      <input {...a} type="text" value={s.size_label} onChange={setSize(i, 'size_label')} placeholder="50ml" maxLength={40} className={`${inputClass} min-h-12 px-3.5`} />
                    )}
                  </Field>
                  <Field small label="Price (GH₵)" error={err('price_ghs')}>
                    {(a) => (
                      <input {...a} {...numberProps} value={s.price_ghs} onChange={setSize(i, 'price_ghs')} placeholder="520" className={`${inputClass} min-h-12 px-3.5`} />
                    )}
                  </Field>
                  <Field small label="Sale price" error={err('sale_price_ghs')}>
                    {(a) => (
                      <input {...a} {...numberProps} value={s.sale_price_ghs} onChange={setSize(i, 'sale_price_ghs')} placeholder="Optional" className={`${inputClass} min-h-12 px-3.5`} />
                    )}
                  </Field>
                  <Field small label="In stock" error={err('stock')}>
                    {(a) => (
                      <input {...a} {...numberProps} value={s.stock} onChange={setSize(i, 'stock')} placeholder="10" className={`${inputClass} min-h-12 px-3.5`} />
                    )}
                  </Field>
                  {sizes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSize(i)}
                      aria-label={`Remove size ${s.size_label || i + 1}`}
                      className="self-end min-h-12 cursor-pointer text-[14px] font-bold text-danger bg-transparent border-[1.5px] border-danger-line rounded-input"
                    >
                      Remove
                    </button>
                  )}
                </fieldset>
              )
            })}
            {sizesError && <span className="text-[14px] font-bold text-rose">{sizesError}</span>}
            {sizes.length < 12 && (
              <button
                type="button"
                onClick={addSize}
                className="self-start inline-flex items-center gap-2 min-h-11 px-[18px] cursor-pointer text-[14px] font-bold text-ink bg-paper border-[1.5px] border-field rounded-full hover:border-ink"
              >
                <PlusIcon size={16} />
                Add another size
              </button>
            )}
          </Card>

          {perfume && (
            <Card title="Scent notes" subtitle="Only for perfumes. Separate with commas.">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
                {[
                  ['notes_top', 'Top', 'bergamot, saffron'],
                  ['notes_heart', 'Heart', 'rose, oud'],
                  ['notes_base', 'Base', 'amber, vanilla, musk'],
                ].map(([k, label, ph]) => (
                  <Field key={k} small label={label}>
                    {(a) => (
                      <input {...a} type="text" value={form[k]} onChange={setField(k)} placeholder={ph} maxLength={200} className={`${inputClass} min-h-12 px-3.5`} />
                    )}
                  </Field>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="flex-[1_1_320px] min-w-0 flex flex-col gap-5 nav:sticky nav:top-6">
          <Card title="Visibility">
            <div role="group" aria-label="Visibility" className="grid grid-cols-2 gap-2">
              {[
                ['live', 'Live in shop'],
                ['draft', 'Hidden draft'],
              ].map(([value, label]) => {
                const on = form.status === value
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      touch()
                      setForm((f) => ({ ...f, status: value }))
                    }}
                    className={`min-h-12 cursor-pointer rounded-input border-[1.5px] ${
                      on ? 'bg-ink text-paper border-ink font-extrabold' : 'bg-paper text-ink border-field font-bold hover:border-ink'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[54px] cursor-pointer text-[16px] font-extrabold text-white bg-rose border-0 rounded-full hover:bg-danger disabled:opacity-60 disabled:cursor-wait"
            >
              {saveLabel}
            </button>
            {formError && <Notice tone="danger">{formError}</Notice>}
            {saved && (
              <Notice>
                {saved}
                {product?.status === 'live' && (
                  <>
                    {' '}
                    <Link to={`/product/${product.slug}`} className="text-success underline underline-offset-2">
                      View in shop
                    </Link>
                  </>
                )}
              </Notice>
            )}
          </Card>

          <Card title="How it looks in the shop">
            <div className="flex flex-col gap-3 max-w-[280px]" aria-hidden="true">
              <div className="relative aspect-[4/5] rounded-admin overflow-hidden bg-peach">
                {coverSrc ? (
                  <img src={coverSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <span className="absolute inset-x-0 bottom-[18px] text-center text-[11px] font-bold tracking-[0.14em] uppercase text-placeholder">
                    Product photo
                  </span>
                )}
                {preview.sale && (
                  <span className="absolute top-3 left-3 px-[11px] py-[5px] bg-rose text-white text-[12px] font-extrabold rounded-full">
                    -{percentOff(preview.v)}%
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-muted">{category?.name || 'Category'}</span>
                <span className="font-bold text-[17px]">
                  {form.name.trim() || 'Product name'}
                  {preview.v?.size_label ? `, ${preview.v.size_label}` : ''}
                </span>
                <div className="flex items-baseline gap-2.5">
                  <span className="font-extrabold text-[17px]">{preview.v ? formatGHS(effectivePrice(preview.v)) : 'GH₵ -'}</span>
                  {preview.sale && <s className="text-[14px] text-strike">{formatGHS(preview.v.price_ghs)}</s>}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {!isNew && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="min-h-11 px-0 font-bold text-danger bg-transparent border-0 underline underline-offset-4 cursor-pointer"
          >
            Delete product
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${product?.name || 'this product'}?`}
        body="It will be removed from the shop and its photos deleted. Past orders keep their details. This cannot be undone."
        confirmLabel="Delete for good"
        busy={deleting}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  )
}

// A fresh form for each product (and for "new"), so state never leaks between them.
export default function ProductFormRoute() {
  const { id } = useParams()
  return <ProductForm key={id || 'new'} />
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { adminFetch } from '../../lib/adminApi'
import { formatGHS } from '../../lib/format'
import { buttonClass } from '../../components/Button'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { Card, Field, Notice, PlusIcon, CloseIcon, inputClass, useDocTitle } from '../ui'
import { displayPhone } from '../orderUi'

let keySeq = 0
const withKey = (z) => ({ ...z, key: `z${++keySeq}` })

// Server data -> form strings
function toForm(s) {
  return {
    shop_name: s.shop_name || '',
    whatsapp: displayPhone(`+${s.whatsapp || ''}`),
    pickup_address: s.pickup_address || '',
    pickup_hours: s.pickup_hours || '',
    cutoff_time: s.cutoff_time || '',
    free_delivery_threshold_ghs: s.free_delivery_threshold_ghs ?? '',
    delivery_zones: (s.delivery_zones || []).map((z) => withKey({ id: z.id, name: z.name, fee_ghs: String(z.fee_ghs) })),
  }
}

export default function Settings() {
  useDocTitle('Settings')
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(null) // JSON of the last saved form, to spot unsaved changes
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const formRef = useRef(null)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const f = toForm(await adminFetch('/settings'))
      setForm(f)
      setSaved(JSON.stringify(f))
    } catch (err) {
      setLoadError(err.message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const dirty = form && saved !== JSON.stringify(form)
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors(({ [key]: _x, ...rest }) => rest)
  }
  const setZone = (i, key) => (e) => {
    const v = e.target.value
    setForm((f) => ({ ...f, delivery_zones: f.delivery_zones.map((z, n) => (n === i ? { ...z, [key]: v } : z)) }))
    if (errors[`zones.${i}.${key}`]) setErrors(({ [`zones.${i}.${key}`]: _x, ...rest }) => rest)
  }
  const addZone = () => {
    setForm((f) => ({ ...f, delivery_zones: [...f.delivery_zones, withKey({ id: null, name: '', fee_ghs: '' })] }))
    setErrors(({ delivery_zones: _x, ...rest }) => rest)
    requestAnimationFrame(() => {
      const inputs = formRef.current?.querySelectorAll('[data-zone-name]')
      inputs?.[inputs.length - 1]?.focus()
    })
  }
  const removeZone = (i) => {
    setForm((f) => ({ ...f, delivery_zones: f.delivery_zones.filter((_, n) => n !== i) }))
    setErrors({}) // indexes shift; errors come back on the next save if still there
  }
  const moveZone = (i, dir) =>
    setForm((f) => {
      const list = [...f.delivery_zones]
      const j = i + dir
      if (j < 0 || j >= list.length) return f
      ;[list[i], list[j]] = [list[j], list[i]]
      return { ...f, delivery_zones: list }
    })

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const res = await adminFetch('/settings', {
        method: 'PUT',
        body: { ...form, delivery_zones: form.delivery_zones.map(({ key: _k, ...z }) => z) },
      })
      const f = toForm(res)
      setForm(f)
      setSaved(JSON.stringify(f))
      setErrors({})
      // The shop picks this up straight away in this browser; shoppers see it within a minute.
      const { delivery_zones, ...rest } = res
      useSettingsStore.setState((st) => ({ settings: { ...st.settings, ...rest, delivery_zones } }))
      setMessage({ tone: 'success', text: 'Settings saved. The shop shows the new details within a minute.' })
    } catch (err) {
      setErrors(err.errors || {})
      setMessage({ tone: 'danger', text: err.message })
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <>
        <h1 className="m-0 font-display font-normal text-[40px] leading-[1.1]">Settings</h1>
        <div className="bg-white rounded-admin p-6 flex flex-col gap-3 items-start">
          <Notice tone="danger">{loadError}</Notice>
          <button type="button" onClick={load} className={buttonClass({ variant: 'secondary', size: 'md' })}>
            Try again
          </button>
        </div>
      </>
    )
  }
  if (!form) {
    return (
      <>
        <h1 className="m-0 font-display font-normal text-[40px] leading-[1.1]">Settings</h1>
        <div className="bg-white rounded-admin p-6 text-muted" role="status">
          Loading settings...
        </div>
      </>
    )
  }

  const threshold = Number(String(form.free_delivery_threshold_ghs).replace(/[,\s]/g, ''))

  return (
    <form ref={formRef} onSubmit={save} noValidate className="flex flex-col gap-6 max-w-[880px]">
      <div className="flex flex-col">
        <h1 className="m-0 font-display font-normal text-[40px] leading-[1.1]">Settings</h1>
        <span className="text-muted">Shop details, delivery areas and fees. Changes show in the shop within a minute.</span>
      </div>

      <Card title="Shop">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shop name" error={errors.shop_name}>
            {(a) => <input {...a} value={form.shop_name} onChange={set('shop_name')} maxLength={60} className={inputClass} />}
          </Field>
          <Field label="WhatsApp number" hint="Where customers message you. Order buttons open this chat." error={errors.whatsapp}>
            {(a) => <input {...a} type="tel" inputMode="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="024 123 4567" className={inputClass} />}
          </Field>
        </div>
      </Card>

      <Card title="Pick up and same-day delivery">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pickup address" optional hint="Shown at checkout and on the order page.">
            {(a) => <input {...a} value={form.pickup_address} onChange={set('pickup_address')} maxLength={200} placeholder="e.g. Osu, Oxford Street, Accra" className={inputClass} />}
          </Field>
          <Field label="Pickup hours" optional hint="Shown next to the address.">
            {(a) => <input {...a} value={form.pickup_hours} onChange={set('pickup_hours')} maxLength={100} placeholder="e.g. Mon to Sat, 10am to 6pm" className={inputClass} />}
          </Field>
          <Field label="Same-day cut-off time" optional hint='Shown as "Order before 2pm for delivery today".'>
            {(a) => <input {...a} value={form.cutoff_time} onChange={set('cutoff_time')} maxLength={40} placeholder="e.g. 2pm" className={inputClass} />}
          </Field>
          <Field
            label="Free delivery from"
            optional
            hint={threshold > 0 ? `Orders of ${formatGHS(threshold)} or more get free delivery.` : 'Leave empty for no free delivery.'}
            error={errors.free_delivery_threshold_ghs}
          >
            {(a) => (
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted pointer-events-none">GH₵</span>
                <input
                  {...a}
                  inputMode="numeric"
                  value={form.free_delivery_threshold_ghs}
                  onChange={set('free_delivery_threshold_ghs')}
                  placeholder="e.g. 500"
                  className={`${inputClass} pl-14`}
                />
              </div>
            )}
          </Field>
        </div>
      </Card>

      <Card title="Delivery areas" subtitle="Customers choose one at checkout. Fees are in whole cedis; use 0 for free.">
        {errors.delivery_zones && <Notice tone="danger">{errors.delivery_zones}</Notice>}
        <ul className="m-0 p-0 list-none flex flex-col gap-3">
          {form.delivery_zones.map((z, i) => {
            const nameErr = errors[`zones.${i}.name`]
            const feeErr = errors[`zones.${i}.fee_ghs`]
            const label = z.name || `area ${i + 1}`
            return (
              <li
                key={z.key}
                className="grid gap-2 grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_auto] items-start pb-3 border-b border-line-soft last:border-0 last:pb-0 sm:pb-0 sm:border-0"
              >
                <div className="col-span-2 sm:col-span-1 flex flex-col gap-1">
                  <label className="sr-only" htmlFor={`${z.key}-name`}>
                    Area name {i + 1}
                  </label>
                  <input
                    id={`${z.key}-name`}
                    data-zone-name
                    value={z.name}
                    onChange={setZone(i, 'name')}
                    maxLength={60}
                    placeholder="e.g. East Legon"
                    aria-invalid={nameErr ? true : undefined}
                    aria-describedby={nameErr ? `${z.key}-name-err` : undefined}
                    className={inputClass}
                  />
                  {nameErr && (
                    <span id={`${z.key}-name-err`} className="text-[13px] font-bold text-rose">
                      {nameErr}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="sr-only" htmlFor={`${z.key}-fee`}>
                    Fee for {label}, in cedis
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted pointer-events-none text-[14px]">GH₵</span>
                    <input
                      id={`${z.key}-fee`}
                      inputMode="numeric"
                      value={z.fee_ghs}
                      onChange={setZone(i, 'fee_ghs')}
                      placeholder="30"
                      aria-invalid={feeErr ? true : undefined}
                      aria-describedby={feeErr ? `${z.key}-fee-err` : undefined}
                      className={`${inputClass} pl-12 pr-2`}
                    />
                  </div>
                  {feeErr && (
                    <span id={`${z.key}-fee-err`} className="text-[13px] font-bold text-rose">
                      {feeErr}
                    </span>
                  )}
                </div>
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => moveZone(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${label} up`}
                    className="hidden sm:grid w-11 h-[50px] place-items-center bg-transparent border-0 text-muted-2 cursor-pointer disabled:opacity-30 text-[18px]"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => removeZone(i)}
                    aria-label={`Remove ${label}`}
                    className="w-11 h-[50px] grid place-items-center bg-transparent border-0 text-muted-2 cursor-pointer hover:text-danger"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          onClick={addZone}
          className="self-start inline-flex items-center gap-2 min-h-11 px-4 rounded-full border-[1.5px] border-dashed border-dash bg-transparent font-bold cursor-pointer hover:border-ink"
        >
          <PlusIcon />
          Add delivery area
        </button>
      </Card>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div className={`${dirty ? 'sticky' : ''} bottom-[calc(76px+env(safe-area-inset-bottom))] nav:bottom-4 z-10 flex flex-wrap items-center gap-3 bg-white rounded-admin p-3 pl-5 border-[1.5px] border-line`}>
        <span className="mr-auto text-[14px] font-bold text-muted-2">{dirty ? 'You have unsaved changes' : 'All changes saved'}</span>
        {dirty && (
          <button type="button" onClick={() => { setForm(JSON.parse(saved)); setErrors({}); setMessage(null) }} className={buttonClass({ variant: 'secondary', size: 'md' })}>
            Undo changes
          </button>
        )}
        <button type="submit" disabled={busy || !dirty} className={buttonClass({ size: 'md' })}>
          {busy ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </form>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/useAuthStore'
import { Field, Notice, inputClass, useDocTitle } from '../ui'
import { buttonClass } from '../../components/Button'
import { AuthCard } from './Login'

// Opened from the "reset your password" email. Supabase signs the user in from the link.
export default function ResetPassword() {
  useDocTitle('New password')
  const navigate = useNavigate()
  const init = useAuthStore((s) => s.init)
  const [hasSession, setHasSession] = useState(null)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    init()
    if (!supabase) return setHasSession(false)
    // The link's token is read on load; give it a moment before deciding it is missing.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      setHasSession(Boolean(data.session))
    }, 600)
    return () => clearTimeout(t)
  }, [init])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (pw.length < 8) return setError('Use at least 8 characters.')
    if (pw !== pw2) return setError('The two passwords do not match.')
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (err) return setError(/same|different/i.test(err.message) ? 'Choose a password you have not used before.' : 'We could not save it. Please try again.')
    navigate('/admin', { replace: true })
  }

  if (hasSession === null) {
    return (
      <AuthCard title="One moment">
        <p className="m-0 text-muted" role="status">Checking your link...</p>
      </AuthCard>
    )
  }
  if (!hasSession) {
    return (
      <AuthCard title="This link has expired">
        <p className="m-0 text-muted">Reset links work once and only for a short time. Ask for a new one.</p>
        <Link to="/admin/login" className={buttonClass({ size: 'md' })}>
          Back to sign in
        </Link>
      </AuthCard>
    )
  }
  return (
    <AuthCard title="Choose a new password">
      {error && <Notice tone="danger">{error}</Notice>}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="New password" hint="At least 8 characters.">
          {(a) => (
            <input {...a} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputClass} />
          )}
        </Field>
        <Field label="Type it again">
          {(a) => (
            <input {...a} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputClass} />
          )}
        </Field>
        <button type="submit" disabled={busy} className={buttonClass({ className: 'w-full' })}>
          {busy ? 'Saving...' : 'Save and sign in'}
        </button>
      </form>
    </AuthCard>
  )
}

import { useEffect, useState } from 'react'
import { Navigate, useSearchParams, Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../lib/supabase'
import { adminReady } from '../../lib/adminApi'
import { Field, Notice, inputClass, useDocTitle } from '../ui'
import { buttonClass } from '../../components/Button'
import Logo from '../../components/Logo'

// Only allow redirects back into the admin
const safeNext = (n) => (n && n.startsWith('/admin') && !n.startsWith('/admin/login') ? n : '/admin')

export function AuthCard({ title, children }) {
  return (
    <div className="min-h-screen bg-shell text-ink grid place-items-center px-4 py-10">
      <main className="w-full max-w-[420px] bg-white rounded-admin p-6 sm:p-8 flex flex-col gap-6">
        <div className="flex items-baseline gap-2.5">
          <Logo />
          <span className="text-[12px] font-bold text-muted">Admin</span>
        </div>
        <h1 className="m-0 font-display font-normal text-[32px] leading-tight">{title}</h1>
        {children}
      </main>
    </div>
  )
}

export default function Login() {
  useDocTitle('Sign in')
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const { status, notice, init, signIn, clearNotice } = useAuthStore()
  const [mode, setMode] = useState('signin') // signin | forgot | sent
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    init()
  }, [init])

  if (status === 'admin') return <Navigate to={next} replace />

  if (!adminReady) {
    return (
      <AuthCard title="Admin is not connected">
        <p className="m-0 text-muted">
          Add VITE_API_URL, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to client/.env, then restart the app.
        </p>
      </AuthCard>
    )
  }

  async function onSignIn(e) {
    e.preventDefault()
    setError('')
    clearNotice()
    if (!email.trim() || !password) return setError('Enter your email and password.')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function onForgot(e) {
    e.preventDefault()
    setError('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter the email you sign in with.')
    setBusy(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/reset`,
    })
    setBusy(false)
    if (!err) return setMode('sent')
    if (err.code === 'over_email_send_rate_limit' || /email rate limit/i.test(err.message)) {
      // Supabase's built-in email sender allows only a few emails per hour
      setError('Too many emails were sent in the last hour. A reset link may already be in your inbox or spam folder. Otherwise, try again in an hour.')
    } else if (err.status === 429 || /seconds|rate/i.test(err.message)) {
      setError('Please wait a minute before asking again.')
    } else {
      setError('We could not send the email. Please try again.')
    }
  }

  const checking = status === 'checking' || status === 'loading'

  if (mode === 'sent') {
    return (
      <AuthCard title="Check your email">
        <p className="m-0 text-muted">
          If {email.trim()} has an admin account, a link to set a new password is on its way. It can take a minute.
        </p>
        <button type="button" onClick={() => setMode('signin')} className={buttonClass({ variant: 'secondary', size: 'md' })}>
          Back to sign in
        </button>
      </AuthCard>
    )
  }

  const forgot = mode === 'forgot'
  return (
    <AuthCard title={forgot ? 'Reset your password' : 'Sign in'}>
      {(notice || error) && <Notice tone="danger">{error || notice}</Notice>}
      <form onSubmit={forgot ? onForgot : onSignIn} className="flex flex-col gap-4" noValidate>
        <Field label="Email">
          {(a) => (
            <input
              {...a}
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          )}
        </Field>
        {!forgot && (
          <Field label="Password">
            {(a) => (
              <div className="relative">
                <input
                  {...a}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-20`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-pressed={showPw}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 px-3 text-[14px] font-bold text-muted bg-transparent border-0 cursor-pointer"
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            )}
          </Field>
        )}
        <button type="submit" disabled={busy || checking} className={buttonClass({ className: 'w-full mt-1' })}>
          {busy || checking ? 'Please wait...' : forgot ? 'Send reset link' : 'Sign in'}
        </button>
      </form>
      <div className="flex justify-between items-center flex-wrap gap-2 text-[14px]">
        <button
          type="button"
          onClick={() => {
            setError('')
            setMode(forgot ? 'signin' : 'forgot')
          }}
          className="min-h-11 font-bold text-ink underline underline-offset-4 bg-transparent border-0 p-0 cursor-pointer"
        >
          {forgot ? 'Back to sign in' : 'Forgot password?'}
        </button>
        <Link to="/" className="min-h-11 inline-flex items-center text-muted">
          Back to the shop
        </Link>
      </div>
    </AuthCard>
  )
}

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { adminFetch, adminReady } from '../lib/adminApi'

// Admin session.
// status: 'loading' -> 'signedOut' | 'checking' -> 'admin' | 'notAdmin'
export const useAuthStore = create((set, get) => ({
  status: 'loading',
  user: null,
  recovery: false, // true after opening a password reset link
  notice: '', // message to show on the sign-in page
  _started: false,
  _checkedFor: null,

  init() {
    if (get()._started) return
    set({ _started: true })
    if (!adminReady) return set({ status: 'signedOut' })

    supabase.auth.getSession().then(({ data }) => get()._apply(data.session))
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') set({ recovery: true })
      // Defer: calling Supabase inside this callback can deadlock.
      setTimeout(() => get()._apply(session), 0)
    })
  },

  async _apply(session) {
    if (!session) return set({ status: 'signedOut', user: null, _checkedFor: null })
    const id = session.user.id
    if (get()._checkedFor === id && (get().status === 'admin' || get().status === 'checking')) return
    set({ status: 'checking', _checkedFor: id })
    try {
      const me = await adminFetch('/me')
      set({ status: 'admin', user: me })
    } catch (err) {
      if (err.status === 403) {
        set({ notice: 'This account cannot use the shop admin. Ask the owner to add you.' })
        await supabase.auth.signOut()
        set({ status: 'notAdmin', user: null, _checkedFor: null })
      } else if (err.status === 401) {
        set({ status: 'signedOut', user: null, _checkedFor: null })
      } else {
        // Server unreachable: show the error on the sign-in page instead of looping.
        set({ status: 'signedOut', user: null, _checkedFor: null, notice: err.message })
      }
    }
  },

  async signIn(email, password) {
    set({ notice: '' })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const msg = /invalid login/i.test(error.message)
        ? 'That email and password do not match. Check them and try again.'
        : /rate|too many/i.test(error.message)
          ? 'Too many tries. Please wait a minute and try again.'
          : /fetch|network/i.test(error.message)
            ? 'We could not reach the sign-in service. Check your connection.'
            : 'We could not sign you in. Please try again.'
      throw new Error(msg)
    }
  },

  async signOut() {
    if (supabase) await supabase.auth.signOut()
    set({ status: 'signedOut', user: null, _checkedFor: null, recovery: false })
  },

  clearNotice: () => set({ notice: '' }),
}))

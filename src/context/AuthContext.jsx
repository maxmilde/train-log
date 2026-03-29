import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]         = useState(undefined) // undefined = still loading
  const [user, setUser]               = useState(null)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    // Detect recovery from URL hash (fallback for PKCE flow where PASSWORD_RECOVERY event may not fire)
    const hash = window.location.hash
    if (hash && (hash.includes('type=recovery') || hash.includes('type%3Drecovery'))) {
      setIsPasswordRecovery(true)
    }
    // Also check URL search params (some Supabase versions use query params)
    const params = new URLSearchParams(window.location.search)
    if (params.get('type') === 'recovery') {
      setIsPasswordRecovery(true)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  async function signInWithMagicLink(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    if (error) throw error
  }

  async function signInWithPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      session,
      user,
      loading: session === undefined,
      isPasswordRecovery,
      clearPasswordRecovery: () => setIsPasswordRecovery(false),
      signInWithMagicLink,
      signInWithPassword,
      signUp,
      updatePassword,
      resetPassword,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

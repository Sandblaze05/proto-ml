'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="22" height="22">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,19.001,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
)

const GitHubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
)

const RegisterForm = ({ onClose = () => { }, initialError = '' }) => {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(initialError)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  const switchMode = (newMode) => {
    setMode(newMode)
    setError('')
    setMessage('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password }, { persistSession: true })
      if (error) { setError(error.message); setLoading(false) }
      else window.location.href = '/dashboard'
    } else {
      const { error } = await supabase.auth.signUp({ email, password }, { persistSession: true })
      if (error) { setError(error.message); setLoading(false) }
      else { setMessage('Check your email for a confirmation link!'); setLoading(false) }
    }
  }

  const handleOAuth = async (provider) => {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
  }

  return (
    <div onClick={() => onClose()} className="fixed inset-0 z-100 bg-black/60 backdrop-blur-md">
      <div onClick={(e) => e.stopPropagation()} className="absolute left-1/2 top-1/2 -translate-1/2 w-90 sm:w-120 bg-[#131313] border-2 border-foreground shadow-2xl">
        <div className="border border-foreground m-3 flex flex-col items-center py-2 gap-4">

          {/* Tab Toggle */}
          <div className="flex w-full mt-6 px-9">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 py-2 font-mono font-bold text-lg border-b-2 transition-colors cursor-pointer ${
                mode === 'signin'
                  ? 'border-foreground text-foreground'
                  : 'border-foreground/20 text-foreground/40 hover:text-foreground/70'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 font-mono font-bold text-lg border-b-2 transition-colors cursor-pointer ${
                mode === 'signup'
                  ? 'border-foreground text-foreground'
                  : 'border-foreground/20 text-foreground/40 hover:text-foreground/70'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col items-center w-full px-9 gap-4 mt-1 min-h-[280px]">
            <input
              type="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-14 focus:outline-0 px-3 py-1 border-3 border-foreground rounded-lg bg-transparent placeholder:text-foreground/40"
            />
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-14 focus:outline-0 px-3 py-1 border-3 border-foreground rounded-lg bg-transparent placeholder:text-foreground/40"
            />
            {mode === 'signup' && (
              <input
                type="password"
                placeholder="confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full h-14 focus:outline-0 px-3 py-1 border-3 border-foreground rounded-lg bg-transparent placeholder:text-foreground/40"
              />
            )}

            {error && <p className="text-red-400 text-sm font-mono text-center w-full">{error}</p>}
            {message && <p className="text-green-400 text-sm font-mono text-center w-full">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-foreground hover:bg-foreground/80 disabled:opacity-50 transition-colors rounded-full text-background font-bold font-mono text-lg cursor-pointer"
            >
              {loading ? '...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center w-2/3 gap-3">
            <div className="flex-1 h-px bg-foreground/30" />
            <span className="text-foreground/50 text-sm font-mono">or</span>
            <div className="flex-1 h-px bg-foreground/30" />
          </div>

          {/* OAuth Buttons */}
          <div className="flex flex-col w-full px-9 gap-3 mb-6">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              className="w-full h-13 flex items-center justify-center gap-3 border-2 border-foreground/40 rounded-full bg-foreground/5 hover:bg-foreground/10 hover:border-foreground/70 transition-all duration-200 font-mono font-semibold text-base text-foreground cursor-pointer"
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('github')}
              className="w-full h-13 flex items-center justify-center gap-3 border-2 border-foreground/40 rounded-full bg-foreground/5 hover:bg-foreground/10 hover:border-foreground/70 transition-all duration-200 font-mono font-semibold text-base text-foreground cursor-pointer"
            >
              <GitHubIcon />
              <span>Continue with GitHub</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

export default RegisterForm
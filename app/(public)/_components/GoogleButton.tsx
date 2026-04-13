'use client'

/**
 * GoogleButton — OAuth sign-in/sign-up via Supabase + Google
 *
 * Calls supabase.auth.signInWithOAuth({ provider: 'google' }).
 * Supabase redirects the user to Google, then back to /auth/callback
 * which exchanges the code and finalises the session.
 *
 * No Google client ID or secret is stored here — those live in the
 * Supabase dashboard under Authentication → Providers → Google.
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface GoogleButtonProps {
  /** Label shown on the button — defaults to "Continue with Google" */
  label?: string
}

export function GoogleButton({ label = 'Continue with Google' }: GoogleButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    setLoading(true)
    console.log('GOOGLE AUTH: initiating OAuth flow')

    const supabase = createClient()
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          // Request refresh token so the session survives long sessions
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    })

    console.log('GOOGLE AUTH RESULT:', { data, error })

    if (error) {
      console.error('GOOGLE AUTH ERROR:', error.message)
      setLoading(false)
    }
    // On success Supabase redirects the browser to Google — no further
    // action needed here; the callback route handles the rest.
  }

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={loading}
      className={cn(
        'w-full flex items-center justify-center gap-2.5',
        'bg-white text-ink text-[14px] font-medium',
        'border-[0.5px] border-beige-300 rounded',
        'py-[13px] px-4',
        'hover:bg-beige-50 hover:border-beige-400',
        'transition-colors duration-150',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'select-none'
      )}
    >
      {loading ? (
        <svg
          className="animate-spin h-[15px] w-[15px] text-ink-soft"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : (
        /* Google G logo */
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
        </svg>
      )}
      {loading ? 'Redirecting…' : label}
    </button>
  )
}

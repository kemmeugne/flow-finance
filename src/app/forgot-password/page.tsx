'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Leaf, ArrowRight, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-50 px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            <MailCheck className="w-14 h-14 text-sage-500" />
          </div>
          <h2 className="text-2xl font-bold text-sage-900">Check your email</h2>
          <p className="text-sage-500 text-sm">
            If an account exists for <strong className="text-sage-800">{email}</strong>, we sent a
            link to reset your password.
          </p>
          <Link
            href="/login"
            className="inline-block mt-4 px-6 py-2.5 rounded-lg border border-sage-300 text-sage-700 text-sm font-medium hover:bg-sage-100 transition-colors"
          >
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sage-50 px-6 py-12">
      <div className="flex items-center gap-2 mb-10">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sage-600">
          <Leaf className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sage-900">Flow Finance</span>
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-sage-900">Reset your password</h2>
          <p className="text-sage-500 mt-1 text-sm">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-sage-800">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Sending…' : (
              <>Send reset link <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <p className="mt-6 text-sm text-sage-500 text-center">
          Remembered it?{' '}
          <Link href="/login" className="font-medium text-sage-700 hover:text-sage-900 underline underline-offset-2">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}

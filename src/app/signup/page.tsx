'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Leaf, ArrowRight, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (data.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.rpc as any)('seed_default_categories', { p_user_id: data.user.id })
    }
    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-50 px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle className="w-14 h-14 text-sage-500" />
          </div>
          <h2 className="text-2xl font-bold text-sage-900">Check your email</h2>
          <p className="text-sage-500 text-sm">
            We sent a confirmation link to <strong className="text-sage-800">{email}</strong>.
            Click it to activate your account.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 px-6 py-2.5 rounded-lg border border-sage-300 text-sage-700 text-sm font-medium hover:bg-sage-100 transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sage-900 flex-col justify-between p-12">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sage-600">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">Flow Finance</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-snug">
            Take control of<br />your cash flow.
          </h1>
          <ul className="space-y-3">
            {[
              'AI-powered income allocation',
              'Budget buckets by priority',
              'Due-date awareness built in',
              'Works for freelancers & variable income',
            ].map(item => (
              <li key={item} className="flex items-center gap-3 text-sage-300 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-sage-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sage-600 text-xs">Free to get started. No credit card required.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-sage-50 px-6 py-12">
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sage-600">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sage-900">Flow Finance</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-sage-900">Create your account</h2>
            <p className="text-sage-500 mt-1 text-sm">Free to start, no card needed</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
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

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-sage-800">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Creating account…' : (
                <>Create account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-sm text-sage-500 text-center">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-sage-700 hover:text-sage-900 underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

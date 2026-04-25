'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Leaf, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* Left panel — sage green branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sage-900 flex-col justify-between p-12">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sage-600">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">Flow Finance</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-white leading-snug">
            Know exactly where<br />your money goes.
          </h1>
          <p className="text-sage-400 text-lg leading-relaxed">
            Built for freelancers and people with variable income. No stress, just clarity.
          </p>
        </div>

        <div className="flex gap-6">
          {['Allocation AI', 'Due-date alerts', 'Goal tracking'].map(f => (
            <div key={f} className="flex items-center gap-2 text-sage-400 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-sage-500 inline-block" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center bg-sage-50 px-6 py-12">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sage-600">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sage-900">Flow Finance</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-sage-900">Welcome back</h2>
            <p className="text-sage-500 mt-1 text-sm">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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
                autoComplete="current-password"
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
              {loading ? 'Signing in…' : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-sm text-sage-500 text-center">
            No account?{' '}
            <Link href="/signup" className="font-medium text-sage-700 hover:text-sage-900 underline underline-offset-2">
              Sign up for free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

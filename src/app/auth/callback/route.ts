import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
    // Email confirmed — sign out so the user must log in explicitly
    if (next === '/welcome') {
      await supabase.auth.signOut()
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}

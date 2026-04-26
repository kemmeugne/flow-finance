import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeAllocations } from '@/lib/finance'
import type { Category } from '@/lib/supabase/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { income } = await request.json() as { income: number }

  const [{ data: categories }, { data: settings }] = await Promise.all([
    supabase.from('categories').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taxCarveout = (settings as any)?.tax_carveout_percent ?? 27
  const cats = (categories ?? []) as Category[]
  const suggestions = computeAllocations(income, cats, taxCarveout)

  return NextResponse.json({ suggestions, categories: cats })
}

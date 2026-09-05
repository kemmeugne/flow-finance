import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Category } from '@/lib/supabase/types'

const anthropic = new Anthropic()

export type AffordResult = {
  verdict: 'yes' | 'caution' | 'no'
  headline: string
  reasoning: string
  suggested_category: string | null
  balance_after: number | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount, description } = await request.json() as { amount: number; description: string }

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('sort_order')

  const cats = (categories ?? []) as Category[]

  const catData = cats.map(c => ({
    id: c.id,
    name: c.name,
    group: c.group_name,
    priority: c.priority,
    current_balance: Math.round(c.current_balance),
    target_amount: Math.round(c.target_amount),
    funded_pct: c.target_amount > 0 ? Math.round((c.current_balance / c.target_amount) * 100) : 100,
    due_date: c.due_date ?? 'none',
  }))

  const prompt = `A Canadian freelancer wants to spend $${amount} CAD on: "${description}".

TODAY: ${new Date().toISOString().split('T')[0]}

THEIR BUDGET CATEGORIES:
${JSON.stringify(catData, null, 2)}

Assess whether they can afford this purchase. Consider:
1. Is there a category that naturally covers this expense? What is its current balance?
2. Will this spending put any critical (P1/P2) categories at risk?
3. What is the real impact on their financial health?

Be direct and practical. Name the best category to take the money from.`

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        tools: [
          {
            name: 'afford_check',
            description: 'Return the affordability assessment.',
            input_schema: {
              type: 'object' as const,
              properties: {
                verdict: {
                  type: 'string',
                  enum: ['yes', 'caution', 'no'],
                  description: '"yes" = clearly affordable, "caution" = possible but will strain budget, "no" = not recommended',
                },
                headline: {
                  type: 'string',
                  description: 'One short punchy sentence, max 80 chars',
                },
                reasoning: {
                  type: 'string',
                  description: '2-3 sentences explaining the decision with specific numbers',
                },
                suggested_category: {
                  type: 'string',
                  description: 'Name of the best category to take money from, or null',
                },
                balance_after: {
                  type: 'number',
                  description: 'Remaining balance in suggested_category after this purchase (integer)',
                },
              },
              required: ['verdict', 'headline', 'reasoning'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'afford_check' },
        messages: [{ role: 'user', content: prompt }],
      })

      const toolBlock = response.content.find(b => b.type === 'tool_use')
      if (toolBlock?.type === 'tool_use') {
        return NextResponse.json(toolBlock.input as AffordResult)
      }
    } catch (err) {
      console.error('Afford check failed:', err)
    }
  }

  // Fallback: basic balance check against lifestyle/living
  const available = cats
    .filter(c => c.group_name === 'operating')
    .reduce((s, c) => s + c.current_balance, 0)

  const fallback: AffordResult = {
    verdict: available >= amount ? 'yes' : 'caution',
    headline: available >= amount
      ? `You have $${Math.round(available)} available in lifestyle/living.`
      : `Lifestyle/living balance is only $${Math.round(available)}.`,
    reasoning: 'Basic balance check only — add ANTHROPIC_API_KEY for full AI analysis.',
    suggested_category: null,
    balance_after: null,
  }
  return NextResponse.json(fallback)
}

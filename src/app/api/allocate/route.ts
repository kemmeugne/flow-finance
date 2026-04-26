import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeAllocations } from '@/lib/finance'
import type { Category } from '@/lib/supabase/types'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

function buildPrompt(income: number, categories: Category[], taxCarveout: number): string {
  const taxReserved = income * (taxCarveout / 100)
  const afterTax = income - taxReserved

  const catData = categories
    .filter(c => c.target_amount > 0)
    .map(c => ({
      id: c.id,
      name: c.name,
      group: c.group_name,
      priority: c.priority,
      current_balance: Math.round(c.current_balance),
      target_amount: Math.round(c.target_amount),
      deficit: Math.max(0, Math.round(c.target_amount - c.current_balance)),
      due_date: c.due_date ?? 'none',
      due_frequency: c.due_frequency,
    }))

  return `You are helping a Canadian freelancer allocate $${income} CAD of income across their budget categories.

ALLOCATION RULES:
1. Tax group (group: "taxes") gets ${taxCarveout}% = $${Math.round(taxReserved)} first — non-negotiable
2. After taxes you have $${Math.round(afterTax)} for everything else
3. Fund P1 (Critical) and P2 (Important) categories fully before any P4-P5 spending
4. Never allocate more than a category's deficit — it's already funded above that
5. Categories with imminent due_date have higher urgency — prioritize them
6. If income exceeds all deficits, route surplus to Emergency Fund or first Goals category
7. Total allocations must not exceed $${income}

TODAY: ${new Date().toISOString().split('T')[0]}

BUDGET CATEGORIES:
${JSON.stringify(catData, null, 2)}

Return allocations only for categories receiving > $0. Keep reasoning under 60 characters.`
}

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

  // ── Try Claude Haiku ──────────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        tools: [
          {
            name: 'allocate_income',
            description: 'Allocate the income amount across the provided budget categories.',
            input_schema: {
              type: 'object' as const,
              properties: {
                allocations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      category_id: { type: 'string', description: 'The id field from the category' },
                      amount:      { type: 'number', description: 'CAD amount to allocate, integer' },
                      reasoning:   { type: 'string', description: 'One-line reason, max 60 chars' },
                    },
                    required: ['category_id', 'amount', 'reasoning'],
                  },
                },
                summary: {
                  type: 'string',
                  description: 'One sentence overview of the allocation strategy (max 120 chars)',
                },
              },
              required: ['allocations', 'summary'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'allocate_income' },
        messages: [{ role: 'user', content: buildPrompt(income, cats, taxCarveout) }],
      })

      const toolBlock = response.content.find(b => b.type === 'tool_use')
      if (toolBlock?.type === 'tool_use') {
        const input = toolBlock.input as {
          allocations: Array<{ category_id: string; amount: number; reasoning: string }>
          summary: string
        }
        const suggestions = input.allocations.filter(a => a.amount > 0)
        return NextResponse.json({ suggestions, categories: cats, source: 'ai', summary: input.summary })
      }
    } catch (err) {
      console.error('Claude allocation failed, falling back to algorithm:', err)
    }
  }

  // ── Fallback: deterministic algorithm ────────────────────────────
  const suggestions = computeAllocations(income, cats, taxCarveout)
  return NextResponse.json({ suggestions, categories: cats, source: 'algorithm', summary: null })
}

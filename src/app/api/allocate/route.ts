import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeAllocations, effectiveDaysUntilDue } from '@/lib/finance'
import type { Category } from '@/lib/supabase/types'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

function buildPrompt(income: number, categories: Category[], taxCarveout: number): string {
  const taxReserved = income * (taxCarveout / 100)
  const afterTax = income - taxReserved

  const today = new Date().toISOString().split('T')[0]

  const catData = categories
    .filter(c => c.target_amount > 0)
    .map(c => {
      const daysUntilDue = Math.round(effectiveDaysUntilDue(c))
      const percentFunded = Math.round((c.current_balance / c.target_amount) * 100)
      const deficit = Math.max(0, Math.round(c.target_amount - c.current_balance))
      return {
        id: c.id,
        name: c.name,
        group: c.group_name,
        priority: c.priority,
        current_balance: Math.round(c.current_balance),
        target_amount: Math.round(c.target_amount),
        deficit,
        percent_funded: percentFunded,
        due_frequency: c.due_frequency ?? 'none',
        days_until_due: daysUntilDue,
      }
    })

  return `You are helping a Canadian freelancer allocate $${income} CAD of income across their budget categories.

TODAY: ${today}

ALLOCATION RULES:
1. Tax group (group: "taxes") gets ${taxCarveout}% = $${Math.round(taxReserved)} first — non-negotiable
2. After taxes you have $${Math.round(afterTax)} for everything else
3. Fund P1 and P2 categories before P3–P5, but read rules 4–6 carefully first
4. Never allocate more than a category's deficit (deficit = 0 → skip entirely)

5. FREQUENCY & AMORTIZATION — never try to fill a long-cycle category in one shot:
   - annual (due_frequency: "annual"): allocate at most ~deficit/12 per income event
   - quarterly: allocate at most ~deficit/3 per event
   - monthly: full deficit is fair game if income allows
   - "none" or "one_time": treat like monthly

6. DAYS_UNTIL_DUE is already cycle-adjusted (if a recurring category just reset, it reflects the next cycle):
   - days_until_due ≤ 30 → genuinely urgent, prioritize it
   - days_until_due 31–90 → moderate urgency, partial funding OK
   - days_until_due > 180 → low urgency, small proportional slice only

7. PERCENT_FUNDED tells you how far along the category already is:
   - percent_funded ≥ 90 AND days_until_due ≤ 14 → SKIP (ready to pay, topped up)
   - percent_funded < 20 AND days_until_due > 200 → very low urgency (cycle just started)
   - Low percent_funded + low days_until_due → genuinely behind, fund urgently

8. If income exceeds all urgent needs, route surplus to Emergency Fund or first Goals category
9. HARD LIMIT: the sum of all allocation amounts must equal exactly $${income}. Check your math.

BUDGET CATEGORIES:
${JSON.stringify(catData, null, 2)}

Return allocations only for categories receiving > $0. Keep reasoning under 60 characters.`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { income, taxable = true } = await request.json() as { income: number; taxable?: boolean }

  const [{ data: categories }, { data: settings }] = await Promise.all([
    supabase.from('categories').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taxCarveout = taxable ? ((settings as any)?.tax_carveout_percent ?? 27) : 0
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
        let suggestions = input.allocations.filter(a => a.amount > 0)

        // Clamp total to income — AI can hallucinate amounts that don't add up
        const r2 = (n: number) => parseFloat(n.toFixed(2))
        const rawTotal = r2(suggestions.reduce((s, a) => s + a.amount, 0))
        if (rawTotal > income + 0.01) {
          const scale = income / rawTotal
          suggestions = suggestions.map(a => ({ ...a, amount: r2(a.amount * scale) }))
          // Fix rounding drift so the total is exact to the cent
          const scaledTotal = r2(suggestions.reduce((s, a) => s + a.amount, 0))
          const drift = r2(r2(income) - scaledTotal)
          if (Math.abs(drift) >= 0.01 && suggestions.length > 0) suggestions[0].amount = r2(suggestions[0].amount + drift)
        }

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

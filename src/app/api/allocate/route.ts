import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeAllocations, effectiveDaysUntilDue, effectiveDeficit } from '@/lib/finance'
import type { Category } from '@/lib/supabase/types'
import type { AllocationSuggestion } from '@/lib/finance'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const r2 = (n: number) => parseFloat(n.toFixed(2))

function buildPrompt(
  remainingForAI: number,
  grossIncome: number,
  categories: Category[],
  preAllocSummary: string,
): string {
  const today = new Date().toISOString().split('T')[0]

  const catData = categories
    .filter(c => c.target_amount > 0)
    .map(c => {
      const daysUntilDue = Math.round(effectiveDaysUntilDue(c))
      const percentFunded = Math.round((c.current_balance / c.target_amount) * 100)
      const currentDeficit = Math.max(0, Math.round(c.target_amount - c.current_balance))
      const effDeficit = Math.round(effectiveDeficit(c))
      const isPreFunding = effDeficit > currentDeficit
      return {
        id: c.id,
        name: c.name,
        group: c.group_name,
        priority: c.priority,
        current_balance: Math.round(c.current_balance),
        target_amount: Math.round(c.target_amount),
        current_deficit: currentDeficit,
        effective_deficit: effDeficit,
        is_pre_funding_next_cycle: isPreFunding,
        percent_funded: percentFunded,
        due_frequency: c.due_frequency ?? 'none',
        days_until_due: daysUntilDue,
      }
    })

  return `You are helping a Canadian freelancer allocate $${remainingForAI} CAD across their budget categories.

TODAY: ${today}

INCOME CONTEXT:
- Gross income received: $${grossIncome}
${preAllocSummary}
- Remaining for you to allocate: $${remainingForAI}

MONEY LAYERS — every category belongs to one, and this is the funding waterfall:
  1. protected — taxes and the emergency fund (tax reserves are ALREADY handled upstream)
  2. operating — this month's living costs: rent, groceries, bills, then discretionary
  3. debt      — paying down credit cards and loans
  4. sinking   — dated future commitments: gifts, trips, courses, big purchases
  5. wealth    — long-term: TFSA, FHSA, RRSP, down payment, retirement

Work down the waterfall: do not fund a lower layer while an upper layer still has an
urgent unmet deficit. Within a layer, priority and days_until_due decide the order.

ALLOCATION RULES:
1. Fund P1 and P2 categories before P3–P5, but read rules 2–4 carefully first

2. ALLOCATION CAP: never exceed a category's effective_deficit.
   - effective_deficit = current_deficit for most categories
   - When is_pre_funding_next_cycle = true: the category is fully funded for this cycle but due very soon. effective_deficit = target_amount for the NEXT cycle. Treat this like a fresh unfunded category — fund it up to target_amount.
   - Never allocate to a category where effective_deficit = 0

3. PRIORITY & PRE-FUNDING — high-priority recurring categories near end of cycle come FIRST:
   - If is_pre_funding_next_cycle = true AND priority ≤ 2: fund before any P3+ categories
   - Monthly operating costs (rent, groceries, etc.) with days_until_due ≤ 10: pre-fund them fully before any discretionary (P4–P5), sinking or wealth category
   - Quarterly with days_until_due ≤ 21: same treatment

4. FREQUENCY & AMORTIZATION — for categories NOT near end of cycle:
   - annual: allocate at most ~current_deficit/12 per income event
   - quarterly: allocate at most ~current_deficit/3 per event
   - monthly: full deficit is fair game

5. DAYS_UNTIL_DUE is cycle-adjusted. PERCENT_FUNDED shows current fill:
   - days_until_due ≤ 30 → urgent (unless is_pre_funding_next_cycle overrides)
   - days_until_due > 180 → low urgency
   - percent_funded ≥ 90 AND days_until_due ≤ 14 AND is_pre_funding_next_cycle = false → SKIP

6. Route any surplus to the Emergency Fund, else the first sinking-layer category
7. HARD LIMIT: allocations must sum to exactly $${remainingForAI}. Check your math.

BUDGET CATEGORIES (taxes already handled — only allocate to these):
${JSON.stringify(catData, null, 2)}

Return allocations only for categories receiving > $0. Keep reasoning under 60 characters.`
}

// Finds a tax category by a keyword in its name (case-insensitive, taxes group only)
function findTaxCat(cats: Category[], keyword: string): Category | undefined {
  return cats.find(c => c.group_name === 'protected' && c.name.toLowerCase().includes(keyword.toLowerCase()))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { income, gst = 0, qst = 0, taxable = true } = await request.json() as {
    income: number   // gross amount
    gst?: number
    qst?: number
    taxable?: boolean
  }

  const [{ data: categories }, { data: settings }] = await Promise.all([
    supabase.from('categories').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = settings as any
  const federalPct: number = taxable ? (s?.federal_tax_percent ?? 15) : 0
  const provincialPct: number = taxable ? (s?.provincial_tax_percent ?? 12) : 0
  const cats = (categories ?? []) as Category[]

  // ── Pre-allocate taxes ────────────────────────────────────────────
  const netIncome = r2(income - gst - qst)
  const gstQstAmt = r2(gst + qst)
  const federalAmt = r2(netIncome * federalPct / 100)
  const provincialAmt = r2(netIncome * provincialPct / 100)

  const gstQstCat = gstQstAmt > 0 ? findTaxCat(cats, 'gst') ?? findTaxCat(cats, 'qst') : undefined
  const federalCat = federalAmt > 0 ? findTaxCat(cats, 'federal') : undefined
  const provincialCat = provincialAmt > 0 ? findTaxCat(cats, 'provincial') : undefined

  const preAllocations: AllocationSuggestion[] = []
  const preAllocatedIds = new Set<string>()

  if (gstQstCat && gstQstAmt > 0) {
    preAllocations.push({ category_id: gstQstCat.id, amount: gstQstAmt, reasoning: 'GST/QST collected — to be remitted' })
    preAllocatedIds.add(gstQstCat.id)
  }
  if (federalCat && federalAmt > 0) {
    preAllocations.push({ category_id: federalCat.id, amount: federalAmt, reasoning: `${federalPct}% federal income tax` })
    preAllocatedIds.add(federalCat.id)
  }
  if (provincialCat && provincialAmt > 0) {
    preAllocations.push({ category_id: provincialCat.id, amount: provincialAmt, reasoning: `${provincialPct}% provincial income tax` })
    preAllocatedIds.add(provincialCat.id)
  }

  const totalPreAllocated = r2(preAllocations.reduce((s, a) => s + a.amount, 0))
  const remainingForAI = r2(income - totalPreAllocated)

  // Categories for AI/algorithm (exclude pre-allocated tax cats)
  const catsForAI = cats.filter(c => !preAllocatedIds.has(c.id))

  // Build summary line for AI prompt context
  const preAllocLines = preAllocations
    .map(p => {
      const cat = cats.find(c => c.id === p.category_id)
      return `  - ${cat?.name ?? 'Tax'}: $${p.amount} reserved`
    })
    .join('\n')

  // ── Try Claude Haiku ──────────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY && remainingForAI > 0) {
    try {
      const prompt = buildPrompt(remainingForAI, income, catsForAI, preAllocLines)
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        tools: [
          {
            name: 'allocate_income',
            description: 'Allocate the remaining income across the provided budget categories.',
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
        messages: [{ role: 'user', content: prompt }],
      })

      const toolBlock = response.content.find(b => b.type === 'tool_use')
      if (toolBlock?.type === 'tool_use') {
        const input = toolBlock.input as {
          allocations: Array<{ category_id: string; amount: number; reasoning: string }>
          summary: string
        }
        let aiSuggestions = input.allocations.filter(a => a.amount > 0)

        // Clamp AI total to remainingForAI
        const rawTotal = r2(aiSuggestions.reduce((s, a) => s + a.amount, 0))
        if (rawTotal > remainingForAI + 0.01) {
          const scale = remainingForAI / rawTotal
          aiSuggestions = aiSuggestions.map(a => ({ ...a, amount: r2(a.amount * scale) }))
          const scaledTotal = r2(aiSuggestions.reduce((s, a) => s + a.amount, 0))
          const drift = r2(remainingForAI - scaledTotal)
          if (Math.abs(drift) >= 0.01 && aiSuggestions.length > 0) {
            aiSuggestions[0].amount = r2(aiSuggestions[0].amount + drift)
          }
        }

        return NextResponse.json({
          suggestions: [...preAllocations, ...aiSuggestions],
          categories: cats,
          source: 'ai',
          summary: input.summary,
        })
      }
    } catch (err) {
      console.error('Claude allocation failed, falling back to algorithm:', err)
    }
  }

  // ── Fallback: deterministic algorithm ────────────────────────────
  const algorithmSuggestions = computeAllocations(remainingForAI, catsForAI)
  return NextResponse.json({
    suggestions: [...preAllocations, ...algorithmSuggestions],
    categories: cats,
    source: 'algorithm',
    summary: null,
  })
}

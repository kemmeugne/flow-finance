import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AllocatedCategory {
  name: string
  amount: number
  reasoning: string
  currentBalance: number
  targetAmount: number
  group: string
}

interface SkippedCategory {
  name: string
  skipReason: string
}

interface ChatContext {
  income: number
  allocations: AllocatedCategory[]
  summary: string | null
  skippedCategories: SkippedCategory[]
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ message: 'AI chat is not configured on this deployment.' })
  }

  const { messages, context } = await request.json() as { messages: ChatMessage[]; context: ChatContext }

  const allocationLines = context.allocations
    .map(a =>
      `- ${a.name} (${a.group}): $${a.amount.toFixed(2)} allocated — ${a.reasoning} [balance: $${a.currentBalance.toFixed(2)} → $${(a.currentBalance + a.amount).toFixed(2)} / target: $${a.targetAmount.toFixed(2)}]`
    )
    .join('\n')

  const skippedLines = context.skippedCategories.length > 0
    ? context.skippedCategories.map(s => `- ${s.name}: ${s.skipReason}`).join('\n')
    : 'None'

  const systemPrompt = `You are a personal finance advisor embedded in Flow Finance, a budgeting app for Canadian freelancers with variable income. You just analyzed $${context.income.toFixed(2)} CAD of income and suggested the following allocation:

${allocationLines}

${context.summary ? `Strategy summary: ${context.summary}` : ''}

Categories not funded this round:
${skippedLines}

Your role: help the user understand your allocation decisions, answer questions about their budget, and suggest adjustments if they want. Be concise, warm, and practical. Explain trade-offs clearly when the user wants to change something.

Formatting rules (always follow these):
- Use **bold** for category names, dollar amounts, and key terms.
- Use bullet points (- item) when listing multiple categories or trade-offs.
- Keep paragraphs short — 2-3 sentences max each.
- Use a short bolded label at the start of a section if covering more than one topic, e.g. **Why skipped:** or **Trade-off:**.
- Never use headers (##). Never use tables.
- Keep responses under 120 words unless the user explicitly asks for a detailed explanation.`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: systemPrompt,
    messages,
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ message: text })
}

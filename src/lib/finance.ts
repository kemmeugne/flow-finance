import type { Category, CategoryGroup } from './supabase/types'

export function formatCurrency(amount: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function groupLabel(group: CategoryGroup): string {
  const labels: Record<CategoryGroup, string> = {
    taxes:       'Taxes',
    bills:       'Bills & Obligations',
    living:      'Living Expenses',
    goals:       'Goals',
    investments: 'Investments',
    lifestyle:   'Lifestyle',
  }
  return labels[group]
}

export function urgencyScore(cat: Category): number {
  if (cat.target_amount <= 0) return 0
  const deficit = Math.max(0, cat.target_amount - cat.current_balance)
  const fundedRatio = cat.current_balance / cat.target_amount
  const daysUntilDue = cat.due_date
    ? Math.max(1, (new Date(cat.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 365

  const priorityWeight = 6 - cat.priority // priority 1 → weight 5, priority 5 → weight 1
  return priorityWeight * (1 - fundedRatio) * (1 / Math.max(1, daysUntilDue / 30)) * deficit
}

export interface AllocationSuggestion {
  category_id: string
  amount: number
  reasoning: string
}

export function computeAllocations(
  income: number,
  categories: Category[],
  taxCarveoutPercent: number
): AllocationSuggestion[] {
  const suggestions: AllocationSuggestion[] = []
  let remaining = income

  const active = categories.filter(c => c.is_active && c.target_amount > 0)

  const round2 = (n: number) => parseFloat(n.toFixed(2))

  // Step 1: Tax carve-out from tax group
  const taxCats = active.filter(c => c.group_name === 'taxes')
  if (taxCats.length > 0) {
    const taxBudget = income * (taxCarveoutPercent / 100)
    const taxDeficit = taxCats.reduce((sum, c) => sum + Math.max(0, c.target_amount - c.current_balance), 0)
    const taxAlloc = Math.min(taxBudget, taxDeficit, remaining)
    const perTaxCat = taxAlloc / taxCats.length

    for (const cat of taxCats) {
      const amt = round2(Math.min(perTaxCat, Math.max(0, cat.target_amount - cat.current_balance)))
      if (amt > 0) {
        suggestions.push({ category_id: cat.id, amount: amt, reasoning: `${taxCarveoutPercent}% tax carve-out` })
        remaining = round2(remaining - amt)
      }
    }
  }

  // Step 2: Score and allocate remaining by urgency
  const nonTax = active.filter(c => c.group_name !== 'taxes')
  const scored = nonTax
    .map(cat => ({ cat, score: urgencyScore(cat) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)

  const totalScore = scored.reduce((sum, x) => sum + x.score, 0)

  for (const { cat, score } of scored) {
    if (remaining <= 0) break
    const deficit = Math.max(0, cat.target_amount - cat.current_balance)
    const proportional = totalScore > 0 ? (score / totalScore) * remaining : 0
    const amt = round2(Math.min(deficit, proportional, remaining))
    if (amt >= 0.01) {
      suggestions.push({
        category_id: cat.id,
        amount: amt,
        reasoning: `Priority ${cat.priority} · ${Math.round((score / totalScore) * 100)}% of urgency score`,
      })
      remaining = round2(remaining - amt)
    }
  }

  // Step 3: Remainder to emergency fund or first goal
  if (remaining >= 0.01) {
    const emergencyFund = categories.find(c => c.name.toLowerCase().includes('emergency'))
    const target = emergencyFund ?? categories.find(c => c.group_name === 'goals')
    if (target) {
      const existing = suggestions.find(s => s.category_id === target.id)
      if (existing) {
        existing.amount = round2(existing.amount + remaining)
        existing.reasoning += ' · surplus'
      } else {
        suggestions.push({ category_id: target.id, amount: remaining, reasoning: 'Surplus funds' })
      }
    }
  }

  return suggestions
}

import type { Category, Account } from './supabase/types'
import { GROUP_CONFIG } from './group-config'
import { isCashAccount, getAccountGroup } from './account-config'

/**
 * The app keeps two parallel ledgers:
 *   • accounts.balance   — what the bank actually holds
 *   • categories.current_balance — how that same money is designated
 *
 * Nothing reconciles them, so both figures below are derived from cash on hand
 * minus category claims, and the gap between them is itself a signal.
 */
export interface AvailableToSpend {
  cash: number          // total across cash accounts
  assets: number        // cash + investment accounts
  spokenFor: number     // every layer except operating
  available: number     // cash − spokenFor  (the headline)
  assigned: number      // assigned across every layer
  unassigned: number    // assets − assigned  (money with no job yet)
  byLayer: { layer: string; label: string; amount: number }[]
  drifted: boolean      // categories claim more than you actually hold
}

export function computeAvailableToSpend(
  categories: Category[],
  accounts: Account[],
): AvailableToSpend {
  const live = accounts.filter(a => a.is_active)
  const cash = live.filter(a => isCashAccount(a.type)).reduce((s, a) => s + a.balance, 0)
  // Wealth categories are often already sitting in an investment account, so the
  // "unassigned" comparison has to weigh claims against cash AND investments —
  // otherwise a funded TFSA permanently trips the drift warning.
  const assets = cash + live
    .filter(a => getAccountGroup(a.type) === 'investments')
    .reduce((s, a) => s + a.balance, 0)

  const active = categories.filter(c => c.is_active)
  const claimed = (pred: (c: Category) => boolean) =>
    active.filter(pred).reduce((s, c) => s + c.current_balance, 0)

  const spokenFor = claimed(c => GROUP_CONFIG[c.group_name]?.spokenFor ?? false)
  const assigned = claimed(() => true)

  const byLayer = (Object.keys(GROUP_CONFIG) as (keyof typeof GROUP_CONFIG)[])
    .filter(layer => GROUP_CONFIG[layer].spokenFor)
    .map(layer => ({
      layer,
      label: GROUP_CONFIG[layer].label,
      amount: claimed(c => c.group_name === layer),
    }))
    .filter(r => r.amount > 0)

  return {
    cash,
    assets,
    spokenFor,
    available: cash - spokenFor,
    assigned,
    unassigned: assets - assigned,
    byLayer,
    drifted: assigned > assets + 0.01,
  }
}

/** Amortises a category target down to what it costs per month. */
export function monthlyCost(cat: Category): number {
  switch (cat.due_frequency) {
    case 'monthly':   return cat.target_amount
    case 'quarterly': return cat.target_amount / 3
    case 'annual':    return cat.target_amount / 12
    default:          return 0   // one_time / none are not recurring costs
  }
}

export interface Runway {
  monthlyNeed: number      // what one month of operating costs
  operatingBalance: number // funded across operating categories
  monthsCovered: number    // operatingBalance ÷ monthlyNeed
  thisMonthPct: number     // 0–100
  nextMonthPct: number     // 0–100
  emergencyBalance: number
  emergencyMonths: number  // months of operating costs the emergency fund covers
  hasData: boolean
}

export function computeRunway(categories: Category[]): Runway {
  const active = categories.filter(c => c.is_active)
  const operating = active.filter(c => c.group_name === 'operating')

  const monthlyNeed = operating.reduce((s, c) => s + monthlyCost(c), 0)
  const operatingBalance = operating.reduce((s, c) => s + c.current_balance, 0)

  // Protected money that is not a tax reserve is the emergency fund.
  const emergencyBalance = active
    .filter(c => c.group_name === 'protected' && !isTaxCategoryName(c.name))
    .reduce((s, c) => s + c.current_balance, 0)

  if (monthlyNeed <= 0) {
    return {
      monthlyNeed: 0, operatingBalance, monthsCovered: 0,
      thisMonthPct: 0, nextMonthPct: 0,
      emergencyBalance, emergencyMonths: 0, hasData: false,
    }
  }

  const monthsCovered = operatingBalance / monthlyNeed
  const clamp = (n: number) => Math.max(0, Math.min(100, n))

  return {
    monthlyNeed,
    operatingBalance,
    monthsCovered,
    thisMonthPct: clamp(monthsCovered * 100),
    nextMonthPct: clamp((monthsCovered - 1) * 100),
    emergencyBalance,
    emergencyMonths: emergencyBalance / monthlyNeed,
    hasData: true,
  }
}

/** Tax reserves are matched by name — the same rule /api/allocate uses. */
export function isTaxCategoryName(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('gst') || n.includes('qst')
    || n.includes('federal') || n.includes('provincial')
    || n.includes('income tax')
}

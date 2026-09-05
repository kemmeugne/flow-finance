import type { CategoryGroup } from './supabase/types'

/**
 * The five money layers. Stored in the `categories.group_name` column — the column
 * keeps its original name so existing rows and queries stay valid, but the values
 * are layers, not the old six categories.
 *
 * Order is the funding waterfall: protected money is reserved first, then the
 * month's operating costs, then debt, then dated commitments, then long-term wealth.
 */
export interface GroupConfig {
  label: string
  blurb: string      // one line: what belongs in this layer
  // true = not available to spend. Only `operating` is false: it is the money you
  // are meant to live on this month. Everything else has already been promised to
  // the government, a deadline, a creditor or your future self.
  spokenFor: boolean
  dot: string        // Tailwind bg color for dot indicator
  border: string     // card left-border color class
  badge: string      // header badge bg + text
  progress: string   // progress bar fill color (CSS var override via style)
  progressHex: string
}

export const GROUP_CONFIG: Record<CategoryGroup, GroupConfig> = {
  protected: {
    label: 'Protected',
    blurb: 'Money that is already someone else’s — taxes and your emergency fund',
    spokenFor: true,
    dot: 'bg-rose-500',
    border: 'border-l-rose-400',
    badge: 'bg-rose-100 text-rose-700',
    progress: '#F43F5E',
    progressHex: '#F43F5E',
  },
  operating: {
    label: 'Operating',
    blurb: 'This month’s living costs — rent, groceries, bills, lifestyle',
    spokenFor: false,
    dot: 'bg-emerald-500',
    border: 'border-l-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700',
    progress: '#10B981',
    progressHex: '#10B981',
  },
  debt: {
    label: 'Debt',
    blurb: 'Paying down what you owe — credit cards, lines of credit, loans',
    spokenFor: true,
    dot: 'bg-slate-500',
    border: 'border-l-slate-400',
    badge: 'bg-slate-100 text-slate-700',
    progress: '#64748B',
    progressHex: '#64748B',
  },
  sinking: {
    label: 'Sinking Funds',
    blurb: 'Known future costs with a date — gifts, trips, courses, big purchases',
    spokenFor: true,
    dot: 'bg-amber-500',
    border: 'border-l-amber-400',
    badge: 'bg-amber-100 text-amber-700',
    progress: '#F59E0B',
    progressHex: '#F59E0B',
  },
  wealth: {
    label: 'Wealth Building',
    blurb: 'Long-term growth — TFSA, FHSA, RRSP, down payment, retirement',
    spokenFor: true,
    dot: 'bg-indigo-500',
    border: 'border-l-indigo-400',
    badge: 'bg-indigo-100 text-indigo-700',
    progress: '#6366F1',
    progressHex: '#6366F1',
  },
}

/** Funding waterfall order — also the display order everywhere in the app. */
export const GROUP_ORDER: CategoryGroup[] = [
  'protected', 'operating', 'debt', 'sinking', 'wealth',
]

/** Layers whose balances are NOT available to spend. */
export const SPOKEN_FOR_LAYERS = GROUP_ORDER.filter(g => GROUP_CONFIG[g].spokenFor)

/**
 * Safe layer lookup. A row that has not been through `migration-layers.sql` still
 * holds an old group value ('bills', 'living', …) — reading GROUP_CONFIG directly
 * would return undefined and white-screen the page. Falls back to operating so a
 * mis-ordered deploy degrades instead of crashing.
 */
export function layerConfig(name: string): GroupConfig {
  return GROUP_CONFIG[name as CategoryGroup] ?? GROUP_CONFIG.operating
}

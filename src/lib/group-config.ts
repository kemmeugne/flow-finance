import type { CategoryGroup } from './supabase/types'

export interface GroupConfig {
  label: string
  dot: string        // Tailwind bg color for dot indicator
  border: string     // card left-border color class
  badge: string      // header badge bg + text
  progress: string   // progress bar fill color (CSS var override via style)
  progressHex: string
}

export const GROUP_CONFIG: Record<CategoryGroup, GroupConfig> = {
  taxes: {
    label: 'Taxes',
    dot: 'bg-rose-500',
    border: 'border-l-rose-400',
    badge: 'bg-rose-100 text-rose-700',
    progress: '#F43F5E',
    progressHex: '#F43F5E',
  },
  bills: {
    label: 'Bills & Obligations',
    dot: 'bg-blue-500',
    border: 'border-l-blue-400',
    badge: 'bg-blue-100 text-blue-700',
    progress: '#3B82F6',
    progressHex: '#3B82F6',
  },
  living: {
    label: 'Living Expenses',
    dot: 'bg-emerald-500',
    border: 'border-l-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700',
    progress: '#10B981',
    progressHex: '#10B981',
  },
  goals: {
    label: 'Goals',
    dot: 'bg-violet-500',
    border: 'border-l-violet-400',
    badge: 'bg-violet-100 text-violet-700',
    progress: '#8B5CF6',
    progressHex: '#8B5CF6',
  },
  investments: {
    label: 'Investments',
    dot: 'bg-indigo-500',
    border: 'border-l-indigo-400',
    badge: 'bg-indigo-100 text-indigo-700',
    progress: '#6366F1',
    progressHex: '#6366F1',
  },
  lifestyle: {
    label: 'Lifestyle',
    dot: 'bg-amber-500',
    border: 'border-l-amber-400',
    badge: 'bg-amber-100 text-amber-700',
    progress: '#F59E0B',
    progressHex: '#F59E0B',
  },
}

export const GROUP_ORDER: CategoryGroup[] = [
  'taxes', 'bills', 'living', 'goals', 'investments', 'lifestyle',
]

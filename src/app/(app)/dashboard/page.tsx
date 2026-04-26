import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, PlusCircle, TrendingUp, CalendarClock } from 'lucide-react'
import { formatCurrency, urgencyScore } from '@/lib/finance'
import { GROUP_CONFIG, GROUP_ORDER } from '@/lib/group-config'
import { LogExpenseButton } from '@/components/layout/log-expense-button'
import { AffordButton } from '@/components/layout/afford-button'
import type { Category, CategoryGroup } from '@/lib/supabase/types'

function fundedPct(cat: Category) {
  if (cat.target_amount <= 0) return 100
  return Math.min(100, Math.round((cat.current_balance / cat.target_amount) * 100))
}

function progressColor(pct: number) {
  if (pct >= 75) return '#10B981'  // emerald
  if (pct >= 40) return '#F59E0B'  // amber
  return '#F43F5E'                 // rose
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .order('sort_order')

  const cats: Category[] = (categories ?? []) as Category[]

  const totalBalance    = cats.reduce((s, c) => s + c.current_balance, 0)
  const totalTarget     = cats.reduce((s, c) => s + c.target_amount, 0)
  const overallPct      = totalTarget > 0 ? Math.round((totalBalance / totalTarget) * 100) : 0
  const underfunded     = cats.filter(c => c.target_amount > 0 && c.current_balance < c.target_amount * 0.5)

  // eslint-disable-next-line react-hooks/purity
  const today = Date.now()
  const upcoming = cats
    .filter(c => {
      if (!c.due_date) return false
      const days = Math.ceil((new Date(c.due_date).getTime() - today) / 86400000)
      return days >= 0 && days <= 45
    })
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())

  const byGroup = GROUP_ORDER.reduce<Record<string, Category[]>>((acc, g) => {
    acc[g] = cats.filter(c => c.group_name === g)
    return acc
  }, {} as Record<string, Category[]>)

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Your financial buckets at a glance
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <AffordButton />
          <LogExpenseButton />
          <Link
            href="/income"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add Income
          </Link>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Total Funded"
          value={formatCurrency(totalBalance)}
          sub={`of ${formatCurrency(totalTarget)} target`}
          accent="indigo"
        />
        <MetricCard
          label="Overall Funded"
          value={`${overallPct}%`}
          sub={overallPct >= 75 ? 'Looking solid' : overallPct >= 40 ? 'Partially funded' : 'Needs attention'}
          accent={overallPct >= 75 ? 'emerald' : overallPct >= 40 ? 'amber' : 'rose'}
        />
        <MetricCard
          label="Categories"
          value={String(cats.length)}
          sub="active buckets"
          accent="slate"
        />
        <MetricCard
          label="Underfunded"
          value={String(underfunded.length)}
          sub={underfunded.length === 0 ? 'All good!' : 'below 50%'}
          accent={underfunded.length === 0 ? 'emerald' : 'rose'}
        />
      </div>

      {/* Underfunded alert */}
      {underfunded.length > 0 && (
        <div className="flex gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-rose-800">Needs funding soon</p>
            <p className="text-sm text-rose-600 mt-0.5">
              {underfunded
                .sort((a, b) => urgencyScore(b) - urgencyScore(a))
                .map(c => c.name)
                .join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Upcoming due dates */}
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Due in the next 45 days</h2>
          </div>
          <div className="space-y-2">
            {upcoming.map(cat => {
              const days = Math.ceil((new Date(cat.due_date!).getTime() - today) / 86400000)
              const pct = cat.target_amount > 0
                ? Math.min(100, Math.round((cat.current_balance / cat.target_amount) * 100))
                : 100
              const deficit = Math.max(0, cat.target_amount - cat.current_balance)
              const cfg = GROUP_CONFIG[cat.group_name as CategoryGroup]
              const urgent = days <= 7

              return (
                <div
                  key={cat.id}
                  className={`flex items-center gap-4 p-3.5 rounded-xl border bg-card ${urgent ? 'border-rose-200' : 'border-border'}`}
                >
                  <div className={`shrink-0 px-2 py-1 rounded-md text-center min-w-[48px] ${urgent ? 'bg-rose-100' : 'bg-muted'}`}>
                    <p className={`text-xs font-bold leading-none ${urgent ? 'text-rose-700' : 'text-foreground'}`}>{days}d</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{cat.name}</span>
                      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: pct >= 75 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#F43F5E' }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground">{pct}%</p>
                    {deficit > 0 && (
                      <p className="text-xs text-muted-foreground">{formatCurrency(deficit)} short</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* If no categories yet */}
      {cats.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TrendingUp className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">No categories yet</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Go to Categories to set up your budget buckets.
          </p>
          <Link
            href="/categories"
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Set up categories
          </Link>
        </div>
      )}

      {/* Category groups */}
      {GROUP_ORDER.map(group => {
        const items = byGroup[group as CategoryGroup]
        if (!items || items.length === 0) return null
        const cfg = GROUP_CONFIG[group as CategoryGroup]

        return (
          <section key={group}>
            {/* Group header */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
                {cfg.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(items.reduce((s, c) => s + c.current_balance, 0))} funded
              </span>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map(cat => {
                const pct = fundedPct(cat)
                const color = progressColor(pct)
                const daysUntil = cat.due_date
                  ? Math.ceil((new Date(cat.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null
                const isDueSoon = daysUntil !== null && daysUntil <= 14

                return (
                  <div
                    key={cat.id}
                    className={`bg-card rounded-xl border border-border border-l-4 ${cfg.border} p-4 hover:shadow-sm transition-shadow`}
                  >
                    {/* Name + priority */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-sm font-semibold text-foreground leading-tight">
                        {cat.name}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        P{cat.priority}
                      </span>
                    </div>

                    {/* Progress bar */}
                    {cat.target_amount > 0 && (
                      <div className="mb-3">
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1.5">
                          <span className="text-xs font-medium" style={{ color }}>
                            {pct}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(cat.current_balance)} / {formatCurrency(cat.target_amount)}
                          </span>
                        </div>
                      </div>
                    )}

                    {cat.target_amount === 0 && (
                      <p className="text-xs text-muted-foreground mb-3">
                        {formatCurrency(cat.current_balance)} available · no target set
                      </p>
                    )}

                    {/* Due date badge */}
                    {isDueSoon && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                        Due in {daysUntil}d
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function MetricCard({
  label, value, sub, accent,
}: {
  label: string
  value: string
  sub: string
  accent: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate'
}) {
  const accentMap = {
    indigo:  'text-indigo-600',
    emerald: 'text-emerald-600',
    amber:   'text-amber-600',
    rose:    'text-rose-600',
    slate:   'text-slate-700',
  }
  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold ${accentMap[accent]}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
}

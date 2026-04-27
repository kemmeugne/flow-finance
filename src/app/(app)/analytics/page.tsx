'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/finance'
import { GROUP_CONFIG } from '@/lib/group-config'

type Period = 3 | 6 | 12

interface MonthBucket {
  key: string    // "2025-01"
  label: string  // "Jan"
  income: number
  spending: number
}

interface GroupBucket {
  group: string
  label: string
  amount: number
  color: string
}

interface CatBucket {
  name: string
  group: string
  amount: number
}

interface AnalyticsData {
  monthly: MonthBucket[]
  byGroup: GroupBucket[]
  topCategories: CatBucket[]
  totalIncome: number
  totalSpending: number
  totalInvested: number
}

const GROUP_COLORS: Record<string, string> = {
  taxes:       '#F43F5E',
  bills:       '#3B82F6',
  living:      '#10B981',
  goals:       '#8B5CF6',
  investments: '#6366F1',
  lifestyle:   '#F59E0B',
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>(6)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (months: Period) => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const start = new Date()
    start.setDate(1)
    start.setMonth(start.getMonth() - months + 1)
    const startStr = start.toISOString().split('T')[0]

    const [txResult, incomeResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('amount, date, categories(name, group_name)')
        .eq('user_id', user.id)
        .gte('date', startStr),
      supabase
        .from('income_events')
        .select('amount, received_at')
        .eq('user_id', user.id)
        .gte('received_at', startStr),
    ])

    const allTxRows = (txResult.data ?? []) as { amount: number; date: string; categories: { name: string; group_name: string } | null }[]
    const incomeRows = (incomeResult.data ?? []) as { amount: number; received_at: string }[]

    // Split: expenses (amount < 0) vs investment allocations (amount > 0, group = investments)
    const txRows = allTxRows.filter(t => t.amount < 0)
    const investmentRows = allTxRows.filter(t => t.amount > 0 && t.categories?.group_name === 'investments')

    // ── Monthly buckets ───────────────────────────────────────────
    const monthlyIncome: Record<string, number> = {}
    const monthlySpending: Record<string, number> = {}
    for (const tx of txRows) {
      const k = tx.date.substring(0, 7)
      monthlySpending[k] = (monthlySpending[k] ?? 0) + Math.abs(tx.amount)
    }
    for (const ev of incomeRows) {
      const k = ev.received_at.substring(0, 7)
      monthlyIncome[k] = (monthlyIncome[k] ?? 0) + ev.amount
    }
    const monthly: MonthBucket[] = Array.from({ length: months }, (_, i) => {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - (months - 1 - i))
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return {
        key,
        label: d.toLocaleDateString('en-CA', { month: 'short' }),
        income: monthlyIncome[key] ?? 0,
        spending: monthlySpending[key] ?? 0,
      }
    })

    // ── Spending by group ─────────────────────────────────────────
    const groupTotals: Record<string, number> = {}
    const catTotals: Record<string, CatBucket> = {}
    for (const tx of txRows) {
      const group = tx.categories?.group_name ?? 'other'
      const name = tx.categories?.name
      const amt = Math.abs(tx.amount)
      groupTotals[group] = (groupTotals[group] ?? 0) + amt
      if (name) {
        if (!catTotals[name]) catTotals[name] = { name, group, amount: 0 }
        catTotals[name].amount += amt
      }
    }
    const byGroup: GroupBucket[] = Object.entries(groupTotals)
      .map(([group, amount]) => ({
        group,
        label: GROUP_CONFIG[group as keyof typeof GROUP_CONFIG]?.label ?? group,
        amount,
        color: GROUP_COLORS[group] ?? '#94A3B8',
      }))
      .filter(g => g.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    const topCategories = Object.values(catTotals)
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)

    const totalIncome = incomeRows.reduce((s, e) => s + e.amount, 0)
    const totalSpending = txRows.reduce((s, t) => s + Math.abs(t.amount), 0)
    const totalInvested = investmentRows.reduce((s, t) => s + t.amount, 0)

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData({ monthly, byGroup, topCategories, totalIncome, totalSpending, totalInvested })
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(period) }, [fetchData, period])

  const maxBar = data ? Math.max(...data.monthly.map(m => Math.max(m.income, m.spending)), 1) : 1
  const savingsRate = data && data.totalIncome > 0 ? (data.totalInvested / data.totalIncome) * 100 : 0
  const maxGroup = data ? Math.max(...data.byGroup.map(g => g.amount), 1) : 1
  const maxCat = data?.topCategories[0]?.amount ?? 1

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Spending trends and income history</p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {([3, 6, 12] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p}M
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Income</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(data.totalIncome)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">last {period} months</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Spent</p>
              <p className="text-xl font-bold text-rose-600">{formatCurrency(data.totalSpending)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">last {period} months</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Invested</p>
              <p className="text-xl font-bold text-indigo-600">{formatCurrency(data.totalInvested)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">into investment accounts</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Savings Rate</p>
              <p className={`text-xl font-bold ${savingsRate >= 20 ? 'text-emerald-600' : savingsRate >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>
                {savingsRate.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{savingsRate >= 20 ? 'Great!' : savingsRate >= 10 ? 'Good' : 'Needs work'}</p>
            </div>
          </div>

          {/* Monthly income vs spending */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-foreground">Monthly Overview</h2>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> Income
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-rose-400 inline-block" /> Spending
                </span>
              </div>
            </div>

            {/* Bars */}
            <div className="flex items-end gap-2 h-40">
              {data.monthly.map(m => (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex gap-0.5 items-end" style={{ height: '120px' }}>
                    <div
                      className="flex-1 bg-emerald-400 rounded-t-sm transition-all duration-300 min-h-[2px]"
                      style={{ height: `${Math.max(2, (m.income / maxBar) * 120)}px` }}
                    />
                    <div
                      className="flex-1 bg-rose-400 rounded-t-sm transition-all duration-300 min-h-[2px]"
                      style={{ height: `${Math.max(2, (m.spending / maxBar) * 120)}px` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">{m.label}</span>
                </div>
              ))}
            </div>

            {/* Month detail on hover is replaced by a simple summary row */}
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Best income month</p>
                <p className="font-medium text-foreground">
                  {data.monthly.reduce((best, m) => m.income > best.income ? m : best, data.monthly[0])?.label ?? '—'}
                  {' '}· {formatCurrency(Math.max(...data.monthly.map(m => m.income)))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Highest spending month</p>
                <p className="font-medium text-foreground">
                  {data.monthly.reduce((hi, m) => m.spending > hi.spending ? m : hi, data.monthly[0])?.label ?? '—'}
                  {' '}· {formatCurrency(Math.max(...data.monthly.map(m => m.spending)))}
                </p>
              </div>
            </div>
          </div>

          {/* Spending breakdown + top categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* By group */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-sm font-semibold text-foreground mb-5">Spending by Group</h2>
              {data.byGroup.length === 0 ? (
                <p className="text-sm text-muted-foreground">No spending recorded in this period.</p>
              ) : (
                <div className="space-y-4">
                  {data.byGroup.map(g => (
                    <div key={g.group}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium text-foreground">{g.label}</span>
                        <span className="text-muted-foreground">{formatCurrency(g.amount)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(g.amount / maxGroup) * 100}%`,
                            backgroundColor: g.color,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {data.totalSpending > 0 ? ((g.amount / data.totalSpending) * 100).toFixed(1) : '0'}% of spending
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top categories */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-sm font-semibold text-foreground mb-5">Top Categories</h2>
              {data.topCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No spending recorded in this period.</p>
              ) : (
                <div className="space-y-3">
                  {data.topCategories.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-foreground truncate">{cat.name}</span>
                          <span className="text-rose-600 shrink-0 ml-2">{formatCurrency(cat.amount)}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(cat.amount / maxCat) * 100}%`,
                              backgroundColor: GROUP_COLORS[cat.group] ?? '#94A3B8',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

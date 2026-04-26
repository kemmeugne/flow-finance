'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/finance'
import { Receipt, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'

type TxRow = {
  id: string
  amount: number
  description: string
  date: string
  categories: { name: string; group_name: string } | null
}

type IncomeRow = {
  id: string
  amount: number
  source: string
  received_at: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export default function TransactionsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [income, setIncome] = useState<IncomeRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const [txResult, incomeResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, amount, description, date, categories(name, group_name)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
      supabase
        .from('income_events')
        .select('id, amount, source, received_at')
        .eq('user_id', user.id)
        .gte('received_at', startDate)
        .lte('received_at', endDate + 'T23:59:59')
        .order('received_at', { ascending: false }),
    ])

    setTransactions((txResult.data ?? []) as unknown as TxRow[])
    setIncome((incomeResult.data ?? []) as unknown as IncomeRow[])
    setLoading(false)
  }, [year, month])

  useEffect(() => { loadData() }, [loadData])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const monthLabel = new Date(year, month).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })

  const totalExpenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalIncome = income.reduce((s, i) => s + i.amount, 0)
  const net = totalIncome - totalExpenses

  // Group expenses by date
  const byDate: Record<string, TxRow[]> = {}
  for (const tx of transactions) {
    if (!byDate[tx.date]) byDate[tx.date] = []
    byDate[tx.date].push(tx)
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Your income and spending history</p>
      </div>

      {/* Month picker */}
      <div className="flex items-center gap-2">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground min-w-[150px] text-center">
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Income</p>
          </div>
          <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Spent</p>
          </div>
          <p className="text-lg font-bold text-rose-600">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Net</p>
          <p className={`text-lg font-bold ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {net >= 0 ? '+' : ''}{formatCurrency(net)}
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
      ) : transactions.length === 0 && income.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Receipt className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">No activity this month</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Add income or log expenses to see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Income events */}
          {income.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Income received</p>
              <div className="space-y-1.5">
                {income.map(ev => (
                  <div
                    key={ev.id}
                    className="bg-card rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 shrink-0">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ev.source}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(ev.received_at.split('T')[0])}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 shrink-0">
                      +{formatCurrency(ev.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expenses grouped by date */}
          {sortedDates.map(date => (
            <div key={date}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {formatDate(date)}
              </p>
              <div className="space-y-1.5">
                {byDate[date].map(tx => (
                  <div
                    key={tx.id}
                    className="bg-card rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.categories?.name ?? '—'}</p>
                    </div>
                    <span
                      className={`text-sm font-semibold shrink-0 ${
                        tx.amount < 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/finance'
import { Receipt, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Download } from 'lucide-react'

type TxRow = {
  id: string
  amount: number
  description: string
  date: string
  account_id: string | null
  categories: { name: string; group_name: string } | null
  accounts: { name: string } | null
}

type IncomeRow = {
  id: string
  amount: number
  source: string
  received_at: string
  account_id: string | null
  accounts: { name: string } | null
}

type AccountOption = { id: string; name: string }

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
  const [accountFilter, setAccountFilter] = useState<string>('')
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([])

  // Load accounts once for the filter dropdown
  useEffect(() => {
    async function loadAccounts() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('accounts').select('id, name')
        .eq('user_id', user.id).eq('is_active', true).order('sort_order')
      setAccountOptions((data ?? []) as AccountOption[])
    }
    loadAccounts()
  }, [])

  useEffect(() => {
    async function fetchData() {
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
          .select('id, amount, description, date, account_id, categories(name, group_name), accounts(name)')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false }),
        supabase
          .from('income_events')
          .select('id, amount, source, received_at, account_id, accounts(name)')
          .eq('user_id', user.id)
          .gte('received_at', startDate)
          .lte('received_at', endDate + 'T23:59:59')
          .order('received_at', { ascending: false }),
      ])

      setTransactions((txResult.data ?? []) as unknown as TxRow[])
      setIncome((incomeResult.data ?? []) as unknown as IncomeRow[])
      setLoading(false)
    }
    fetchData()
  }, [year, month])

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

  // Apply account filter
  const filteredTransactions = accountFilter
    ? transactions.filter(t => t.account_id === accountFilter)
    : transactions
  const filteredIncome = accountFilter
    ? income.filter(ev => ev.account_id === accountFilter)
    : income

  const totalExpenses = filteredTransactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalIncome = filteredIncome.reduce((s, i) => s + i.amount, 0)
  const net = totalIncome - totalExpenses

  function exportCSV() {
    const rows: string[] = [
      'Date,Type,Description,Category,Account,Amount (CAD)',
      ...filteredIncome.map(ev =>
        `${ev.received_at.split('T')[0]},Income,"${ev.source.replace(/"/g, '""')}",,` +
        `"${(ev.accounts?.name ?? '').replace(/"/g, '""')}",${ev.amount.toFixed(2)}`
      ),
      ...filteredTransactions.map(tx =>
        `${tx.date},Expense,"${tx.description.replace(/"/g, '""')}",` +
        `"${(tx.categories?.name ?? '').replace(/"/g, '""')}",` +
        `"${(tx.accounts?.name ?? '').replace(/"/g, '""')}",${tx.amount.toFixed(2)}`
      ),
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flow-finance-${year}-${String(month + 1).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Group expenses by date
  const byDate: Record<string, TxRow[]> = {}
  for (const tx of filteredTransactions) {
    if (!byDate[tx.date]) byDate[tx.date] = []
    byDate[tx.date].push(tx)
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your income and spending history</p>
        </div>
        {(filteredTransactions.length > 0 || filteredIncome.length > 0) && !loading && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Month picker + account filter */}
      <div className="flex items-center gap-3 flex-wrap">
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

        {accountOptions.length > 0 && (
          <select
            value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sage-500"
          >
            <option value="">All accounts</option>
            {accountOptions.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
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
      ) : filteredTransactions.length === 0 && filteredIncome.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Receipt className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">No activity this month</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {accountFilter ? 'No transactions for this account.' : 'Add income or log expenses to see them here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Income events */}
          {filteredIncome.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Income received</p>
              <div className="space-y-1.5">
                {filteredIncome.map(ev => (
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-muted-foreground">{formatDate(ev.received_at.split('T')[0])}</p>
                          {ev.accounts?.name && (
                            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              {ev.accounts.name}
                            </span>
                          )}
                        </div>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground">{tx.categories?.name ?? '—'}</p>
                        {tx.accounts?.name && (
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            {tx.accounts.name}
                          </span>
                        )}
                      </div>
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

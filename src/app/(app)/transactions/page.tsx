'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/finance'
import { isDebtAccount } from '@/lib/account-config'
import { Receipt, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Download, Trash2, ArrowRightLeft } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

type TxRow = {
  id: string
  amount: number
  description: string
  date: string
  category_id: string | null
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

type TransferRow = {
  id: string
  amount: number
  description: string | null
  date: string
  from_account_id: string
  to_account_id: string
  from_account: { name: string; type: string } | null
  to_account: { name: string; type: string } | null
}

type AccountOption = { id: string; name: string }

type DeleteTarget =
  | { type: 'tx'; row: TxRow }
  | { type: 'income'; row: IncomeRow }
  | { type: 'transfer'; row: TransferRow }

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
  const [transfers, setTransfers] = useState<TransferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [accountFilter, setAccountFilter] = useState<string>('')
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([])
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const [txResult, incomeResult, transferResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, amount, description, date, category_id, account_id, categories(name, group_name), accounts(name)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .lt('amount', 0)
        .order('date', { ascending: false }),
      supabase
        .from('income_events')
        .select('id, amount, source, received_at, account_id, accounts(name)')
        .eq('user_id', user.id)
        .gte('received_at', startDate)
        .lte('received_at', endDate + 'T23:59:59')
        .order('received_at', { ascending: false }),
      supabase
        .from('account_transfers')
        .select('id, amount, description, date, from_account_id, to_account_id, from_account:accounts!from_account_id(name, type), to_account:accounts!to_account_id(name, type)')
        .eq('user_id', user.id)
        .is('transaction_id', null)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
    ])

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransactions((txResult.data ?? []) as unknown as TxRow[])
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIncome((incomeResult.data ?? []) as unknown as IncomeRow[])
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTransfers((transferResult.data ?? []) as unknown as TransferRow[])
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    if (deleteTarget.type === 'tx') {
      const tx = deleteTarget.row
      // tx.amount is negative for expenses; reversing means subtracting it (adding the absolute value)

      // 1. Restore category balance
      if (tx.category_id) {
        const { data: cat } = await supabase.from('categories').select('current_balance').eq('id', tx.category_id).maybeSingle()
        if (cat) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.from('categories').update({ current_balance: (cat as any).current_balance - tx.amount }).eq('id', tx.category_id)
        }
      }

      // 2. Restore cash account balance
      if (tx.account_id) {
        const { data: acct } = await supabase.from('accounts').select('balance').eq('id', tx.account_id).maybeSingle()
        if (acct) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.from('accounts').update({ balance: (acct as any).balance - tx.amount }).eq('id', tx.account_id)
        }
      }

      // 3. If debt payment: restore debt account + delete transfer record
      const { data: transfer } = await supabase.from('account_transfers').select('to_account_id, amount').eq('transaction_id', tx.id).maybeSingle()
      if (transfer) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = transfer as any
        const { data: debtAcct } = await supabase.from('accounts').select('balance').eq('id', t.to_account_id).maybeSingle()
        if (debtAcct) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.from('accounts').update({ balance: (debtAcct as any).balance + t.amount }).eq('id', t.to_account_id)
        }
        await db.from('account_transfers').delete().eq('transaction_id', tx.id)
      }

      await db.from('transactions').delete().eq('id', tx.id)

    } else if (deleteTarget.type === 'income') {
      const ev = deleteTarget.row

      // 1. Find all allocations for this income event
      const { data: allocations } = await supabase
        .from('allocations')
        .select('id, category_id, confirmed_amount')
        .eq('income_event_id', ev.id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allocs = (allocations ?? []) as any[]

      // 2. Reverse each category balance
      for (const alloc of allocs) {
        const { data: cat } = await supabase.from('categories').select('current_balance').eq('id', alloc.category_id).maybeSingle()
        if (cat) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.from('categories').update({ current_balance: (cat as any).current_balance - alloc.confirmed_amount }).eq('id', alloc.category_id)
        }
      }

      // 3. Delete allocation transactions, then allocations
      if (allocs.length > 0) {
        const allocIds = allocs.map((a: { id: string }) => a.id)
        await db.from('transactions').delete().in('allocation_id', allocIds)
        await db.from('allocations').delete().eq('income_event_id', ev.id)
      }

      // 4. Restore account balance if linked
      if (ev.account_id) {
        const { data: acct } = await supabase.from('accounts').select('balance').eq('id', ev.account_id).maybeSingle()
        if (acct) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.from('accounts').update({ balance: (acct as any).balance - ev.amount }).eq('id', ev.account_id)
        }
      }

      await db.from('income_events').delete().eq('id', ev.id)
    }

    if (deleteTarget.type === 'transfer') {
      const tr = deleteTarget.row
      const fromDelta = tr.from_account && isDebtAccount(tr.from_account.type) ? -tr.amount : tr.amount
      const toDelta = tr.to_account && isDebtAccount(tr.to_account.type) ? tr.amount : -tr.amount

      const { data: fromAcct } = await supabase.from('accounts').select('balance').eq('id', tr.from_account_id).maybeSingle()
      const { data: toAcct } = await supabase.from('accounts').select('balance').eq('id', tr.to_account_id).maybeSingle()

      await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fromAcct ? db.from('accounts').update({ balance: (fromAcct as any).balance + fromDelta }).eq('id', tr.from_account_id) : Promise.resolve(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toAcct   ? db.from('accounts').update({ balance: (toAcct   as any).balance + toDelta   }).eq('id', tr.to_account_id)   : Promise.resolve(),
      ])
      await db.from('account_transfers').delete().eq('id', tr.id)
    }

    setDeleting(false)
    setDeleteTarget(null)
    fetchData()
  }

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

  const filteredTransactions = accountFilter
    ? transactions.filter(t => t.account_id === accountFilter)
    : transactions
  const filteredIncome = accountFilter
    ? income.filter(ev => ev.account_id === accountFilter)
    : income
  const filteredTransfers = accountFilter
    ? transfers.filter(tr => tr.from_account_id === accountFilter || tr.to_account_id === accountFilter)
    : transfers

  const totalExpenses = filteredTransactions.reduce((s, t) => s + Math.abs(t.amount), 0)
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

  const byDate: Record<string, TxRow[]> = {}
  for (const tx of filteredTransactions) {
    if (!byDate[tx.date]) byDate[tx.date] = []
    byDate[tx.date].push(tx)
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  const deleteLabel = deleteTarget?.type === 'income'
    ? `income of ${formatCurrency(deleteTarget.row.amount)} from "${deleteTarget.row.source}"`
    : deleteTarget?.type === 'tx'
    ? `expense of ${formatCurrency(Math.abs(deleteTarget.row.amount))} — "${deleteTarget.row.description}"`
    : deleteTarget?.type === 'transfer'
    ? `transfer of ${formatCurrency(deleteTarget.row.amount)} from ${deleteTarget.row.from_account?.name} to ${deleteTarget.row.to_account?.name}`
    : ''

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
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-foreground min-w-[150px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} disabled={isCurrentMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Next month">
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
      ) : filteredTransactions.length === 0 && filteredIncome.length === 0 && filteredTransfers.length === 0 ? (
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
                    className="bg-card rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-3 group"
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
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-emerald-600">
                        +{formatCurrency(ev.amount)}
                      </span>
                      <button
                        onClick={() => setDeleteTarget({ type: 'income', row: ev })}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete income entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transfers */}
          {filteredTransfers.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Transfers</p>
              <div className="space-y-1.5">
                {filteredTransfers.map(tr => (
                  <div
                    key={tr.id}
                    className="bg-card rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 shrink-0">
                        <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {tr.from_account?.name ?? '—'} → {tr.to_account?.name ?? '—'}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-muted-foreground">{formatDate(tr.date)}</p>
                          {tr.description && (
                            <span className="text-xs text-muted-foreground truncate">{tr.description}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-blue-600">
                        {formatCurrency(tr.amount)}
                      </span>
                      <button
                        onClick={() => setDeleteTarget({ type: 'transfer', row: tr })}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete transfer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
                    className="bg-card rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-3 group"
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
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-semibold ${tx.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount))}
                      </span>
                      <button
                        onClick={() => setDeleteTarget({ type: 'tx', row: tx })}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete and reverse?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {deleteLabel} and reverse all associated balance changes
              {deleteTarget?.type === 'income' ? ', including every category allocation' : ''}
              {deleteTarget?.type === 'transfer' ? ' on both accounts' : ''}.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? 'Reversing…' : 'Delete & reverse'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MinusCircle, CheckCircle } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/finance'
import { GROUP_CONFIG, GROUP_ORDER } from '@/lib/group-config'
import type { Category, CategoryGroup, Account } from '@/lib/supabase/types'

export function LogExpenseButton() {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  // Map from category_id → the debt account it pays
  const [paymentCategoryMap, setPaymentCategoryMap] = useState<Map<string, Account>>(new Map())
  const [form, setForm] = useState({
    category_id: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    from_account_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: catData }, { data: acctData }] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user!.id).eq('is_active', true).order('group_name').order('sort_order'),
      supabase.from('accounts').select('*').eq('user_id', user!.id).eq('is_active', true),
    ])
    const cats = (catData ?? []) as Category[]
    const accts = (acctData ?? []) as Account[]
    setCategories(cats)
    setAccounts(accts)

    // Build reverse map: payment_category_id → account
    const map = new Map<string, Account>()
    for (const acct of accts) {
      if (acct.payment_category_id) map.set(acct.payment_category_id, acct)
    }
    setPaymentCategoryMap(map)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && categories.length === 0) loadData()
  }, [open, loadData, categories.length])

  function resetForm() {
    setForm({ category_id: '', amount: '', description: '', date: new Date().toISOString().split('T')[0], from_account_id: '' })
  }

  // When category changes: default to first checking account for all expenses
  function handleCategoryChange(category_id: string) {
    const cashAccts = accounts.filter(a => ['checking', 'savings', 'cash'].includes(a.type))
    const firstChecking = cashAccts.find(a => a.type === 'checking') ?? cashAccts[0]
    setForm(p => ({ ...p, category_id, from_account_id: firstChecking?.id ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: { user } } = await supabase.auth.getUser()
    const cat = categories.find(c => c.id === form.category_id)
    if (!cat || !user) { setSaving(false); return }

    const amount = parseFloat(form.amount)
    const linkedDebtAccount = paymentCategoryMap.get(form.category_id)
    const fromAccount = form.from_account_id
      ? accounts.find(a => a.id === form.from_account_id)
      : undefined

    // 1. Standard expense: log transaction + reduce category balance
    const { data: txn } = await db.from('transactions').insert({
      user_id: user.id,
      category_id: form.category_id,
      amount: -amount,
      description: form.description.trim(),
      date: form.date,
      allocation_id: null,
      account_id: form.from_account_id || null,
    }).select().single()

    await db.from('categories')
      .update({ current_balance: cat.current_balance - amount })
      .eq('id', form.category_id)

    // 2. Deduct from cash account for all expenses
    if (fromAccount) {
      await db.from('accounts')
        .update({ balance: fromAccount.balance - amount })
        .eq('id', fromAccount.id)
    }

    // 3. Payment category: also reduce the debt account + record the transfer
    if (linkedDebtAccount) {
      await db.from('accounts')
        .update({ balance: Math.max(0, linkedDebtAccount.balance - amount) })
        .eq('id', linkedDebtAccount.id)

      if (fromAccount) {
        await db.from('account_transfers').insert({
          user_id: user.id,
          from_account_id: fromAccount.id,
          to_account_id: linkedDebtAccount.id,
          amount,
          date: form.date,
          description: form.description.trim() || `Payment to ${linkedDebtAccount.name}`,
          transaction_id: txn?.id ?? null,
        })
      }
    }

    setSaving(false)
    setDone(true)

    setTimeout(() => {
      setDone(false)
      setOpen(false)
      resetForm()
      router.refresh()
    }, 1200)
  }

  const selectedCat = categories.find(c => c.id === form.category_id)
  const linkedDebtAccount = paymentCategoryMap.get(form.category_id)
  const cashAccounts = accounts.filter(a => ['checking', 'savings', 'cash'].includes(a.type))

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <MinusCircle className="w-4 h-4" />
        Log Expense
      </button>

      <Sheet open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm() }}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col overflow-y-auto">
          <SheetHeader className="border-b border-border px-6 py-5">
            <SheetTitle className="text-lg">Log an Expense</SheetTitle>
          </SheetHeader>

          {done ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6">
              <CheckCircle className="w-12 h-12 text-sage-500" />
              <p className="text-sm font-medium text-foreground">
                {linkedDebtAccount ? 'Payment recorded!' : 'Expense logged!'}
              </p>
              <p className="text-xs text-muted-foreground">Balance updated.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 px-6 py-6 space-y-5">

              {/* Category */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Category *</label>
                <select
                  value={form.category_id}
                  onChange={e => handleCategoryChange(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                >
                  <option value="">Select a category…</option>
                  {GROUP_ORDER.map(group => {
                    const items = categories.filter(c => c.group_name === group)
                    if (!items.length) return null
                    return (
                      <optgroup key={group} label={GROUP_CONFIG[group as CategoryGroup].label}>
                        {items.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} — {formatCurrency(cat.current_balance)} available
                          </option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>

                {selectedCat && (
                  <p className="text-xs text-muted-foreground">
                    Balance:{' '}
                    <span className="font-medium text-foreground">{formatCurrency(selectedCat.current_balance)}</span>
                    {form.amount && parseFloat(form.amount) > 0 && (
                      <> → <span className={selectedCat.current_balance - parseFloat(form.amount) < 0 ? 'text-destructive font-medium' : 'font-medium'}>
                        {formatCurrency(selectedCat.current_balance - parseFloat(form.amount))}
                      </span></>
                    )}
                  </p>
                )}

                {/* Payment category info banner */}
                {linkedDebtAccount && (
                  <div className="rounded-lg bg-sage-50 border border-sage-200 px-3 py-2.5 text-xs text-sage-700">
                    This payment will reduce your <strong>{linkedDebtAccount.name}</strong> balance
                    ({formatCurrency(linkedDebtAccount.balance)} outstanding).
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Amount (CAD) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                    className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>
              </div>

              {/* Pay from account */}
              {cashAccounts.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Pay from account</label>
                  <select
                    value={form.from_account_id}
                    onChange={e => setForm(p => ({ ...p, from_account_id: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                  >
                    <option value="">Not tracked</option>
                    {cashAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {formatCurrency(a.balance)}
                      </option>
                    ))}
                  </select>
                  {form.from_account_id && form.amount && parseFloat(form.amount) > 0 && (() => {
                    const acct = accounts.find(a => a.id === form.from_account_id)
                    const after = (acct?.balance ?? 0) - parseFloat(form.amount)
                    return (
                      <p className="text-xs text-muted-foreground">
                        Account balance after: <span className={after < 0 ? 'text-destructive font-medium' : 'font-medium text-foreground'}>{formatCurrency(after)}</span>
                      </p>
                    )
                  })()}
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Description *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Groceries at Metro, January rent…"
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>

              <div className="flex-1" />

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-destructive text-white rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60"
              >
                <MinusCircle className="w-4 h-4" />
                {saving ? 'Saving…' : linkedDebtAccount ? 'Record payment' : 'Log expense'}
              </button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

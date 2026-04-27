'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle, Wallet, SlidersHorizontal, Banknote } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/finance'
import {
  ACCOUNT_GROUP_CONFIG, ACCOUNT_GROUP_ORDER, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_TO_GROUP,
  YEARLY_CONTRIBUTION_LIMITS,
  isDebtAccount, isRegisteredAccount, isCashAccount, getAccountGroup, balanceLabel,
} from '@/lib/account-config'
import { AssignFundsSheet } from '@/components/layout/assign-funds-sheet'
import type { Account } from '@/lib/supabase/types'
import type { AccountType, AccountGroup } from '@/lib/account-config'

interface AccountForm {
  name: string
  type: AccountType | ''
  balance: string
  credit_limit: string
  interest_rate: string
  min_payment: string
  contribution_room: string
  yearly_contribution_limit: string
  contributions_ytd: string
  notes: string
}

const EMPTY_FORM: AccountForm = {
  name: '', type: '', balance: '0', credit_limit: '',
  interest_rate: '', min_payment: '0', contribution_room: '',
  yearly_contribution_limit: '', contributions_ytd: '0', notes: '',
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Account | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Account | null>(null)
  const [assignTarget, setAssignTarget] = useState<Account | null>(null)
  const [reconcileTarget, setReconcileTarget] = useState<Account | null>(null)
  const [reconcileActual, setReconcileActual] = useState<string>('')
  const [reconciling, setReconciling] = useState(false)
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('accounts').select('*')
      .eq('user_id', user!.id).eq('is_active', true)
      .order('sort_order')
    setAccounts((data ?? []) as Account[])
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(account: Account) {
    setEditTarget(account)
    setForm({
      name: account.name,
      type: account.type as AccountType,
      balance: String(account.balance),
      credit_limit: account.credit_limit != null ? String(account.credit_limit) : '',
      interest_rate: account.interest_rate != null ? String(account.interest_rate) : '',
      min_payment: '0',
      contribution_room: account.contribution_room != null ? String(account.contribution_room) : '',
      yearly_contribution_limit: account.yearly_contribution_limit != null ? String(account.yearly_contribution_limit) : '',
      contributions_ytd: String(account.contributions_ytd ?? 0),
      notes: account.notes ?? '',
    })
    setDialogOpen(true)
  }

  function setField<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleTypeChange(type: AccountType | '') {
    setForm(prev => ({
      ...prev,
      type,
      yearly_contribution_limit: type
        ? (YEARLY_CONTRIBUTION_LIMITS[type]?.toString() ?? prev.yearly_contribution_limit)
        : '',
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.type) return
    setSaving(true)

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : null,
      interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : null,
      contribution_room: form.contribution_room ? parseFloat(form.contribution_room) : null,
      yearly_contribution_limit: form.yearly_contribution_limit ? parseFloat(form.yearly_contribution_limit) : null,
      contributions_ytd: parseFloat(form.contributions_ytd) || 0,
      notes: form.notes.trim() || null,
      is_active: true,
    }

    if (editTarget) {
      await db.from('accounts').update(payload).eq('id', editTarget.id)
    } else {
      const groupCount = accounts.filter(a => getAccountGroup(a.type) === getAccountGroup(form.type)).length
      const { data: newAccount } = await db
        .from('accounts')
        .insert({ ...payload, user_id: user.id, sort_order: groupCount })
        .select()
        .single()

      // Auto-create payment category for debt accounts
      if (newAccount && isDebtAccount(form.type)) {
        const { data: newCat } = await db
          .from('categories')
          .insert({
            user_id: user.id,
            name: `${form.name.trim()} Payment`,
            group_name: 'bills',
            target_amount: parseFloat(form.min_payment) || 0,
            current_balance: 0,
            priority: 2,
            due_frequency: 'monthly',
            sort_order: 999,
            is_active: true,
          })
          .select()
          .single()

        if (newCat) {
          await db.from('accounts').update({ payment_category_id: newCat.id }).eq('id', newAccount.id)
        }
      }
    }

    setSaving(false)
    setDialogOpen(false)
    load()
  }

  async function handleReconcile(e: React.FormEvent) {
    e.preventDefault()
    if (!reconcileTarget) return
    setReconciling(true)
    const actual = parseFloat(reconcileActual)
    if (!isNaN(actual)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (createClient() as any).from('accounts').update({ balance: actual }).eq('id', reconcileTarget.id)
    }
    setReconciling(false)
    setReconcileTarget(null)
    setReconcileActual('')
    load()
  }

  async function handleArchive() {
    if (!archiveTarget) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createClient() as any).from('accounts').update({ is_active: false }).eq('id', archiveTarget.id)
    setArchiveTarget(null)
    load()
  }

  // ── Net worth ─────────────────────────────────────────────────────
  const byGroup = ACCOUNT_GROUP_ORDER.reduce<Record<AccountGroup, Account[]>>((acc, g) => {
    acc[g] = accounts.filter(a => getAccountGroup(a.type) === g)
    return acc
  }, {} as Record<AccountGroup, Account[]>)

  const cashTotal        = byGroup.cash.reduce((s, a) => s + a.balance, 0)
  const investmentTotal  = byGroup.investments.reduce((s, a) => s + a.balance, 0)
  const creditTotal      = byGroup.credit.reduce((s, a) => s + a.balance, 0)
  const loanTotal        = byGroup.loans.reduce((s, a) => s + a.balance, 0)
  const totalAssets      = cashTotal + investmentTotal
  const totalLiabilities = creditTotal + loanTotal
  const netWorth         = totalAssets - totalLiabilities

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {accounts.length} active account{accounts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
        </div>
      )}

      {/* Net worth summary */}
      {!loading && accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Net Worth</p>
            <p className={`text-xl font-bold ${netWorth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(netWorth)}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Assets</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalAssets)}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Liabilities</p>
            <p className="text-xl font-bold text-rose-600">{formatCurrency(totalLiabilities)}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Wallet className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">No accounts yet</h2>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Add your checking, credit card, and investment accounts to see your full financial picture.
          </p>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Add your first account
          </button>
        </div>
      )}

      {/* Account group sections */}
      {!loading && ACCOUNT_GROUP_ORDER.map(group => {
        const items = byGroup[group]
        if (!items?.length) return null
        const cfg = ACCOUNT_GROUP_CONFIG[group]

        const groupTotal = items.reduce((s, a) => s + a.balance, 0)

        return (
          <section key={group}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
                {cfg.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {cfg.isDebt ? '−' : ''}{formatCurrency(groupTotal)}
              </span>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {items.map((account, idx) => {
                const isLast = idx === items.length - 1
                const creditPct = account.credit_limit
                  ? Math.min(100, Math.round((account.balance / account.credit_limit) * 100))
                  : null
                const contribPct = isRegisteredAccount(account.type) && account.yearly_contribution_limit
                  ? Math.min(100, Math.round(((account.contributions_ytd ?? 0) / account.yearly_contribution_limit) * 100))
                  : null

                return (
                  <div
                    key={account.id}
                    className={`flex items-center gap-4 px-4 py-3.5 hover:bg-muted/50 transition-colors group ${!isLast ? 'border-b border-border' : ''}`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{account.name}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {ACCOUNT_TYPE_LABELS[account.type as AccountType]}
                        </span>
                        {account.interest_rate != null && (
                          <span className="text-xs text-muted-foreground">{account.interest_rate}% APR</span>
                        )}
                      </div>

                      {/* Credit usage bar */}
                      {creditPct !== null && account.credit_limit && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${creditPct}%`,
                                backgroundColor: creditPct >= 80 ? '#F43F5E' : creditPct >= 50 ? '#F59E0B' : '#10B981',
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatCurrency(account.balance)} / {formatCurrency(account.credit_limit)} used
                          </span>
                        </div>
                      )}

                      {/* Contribution room bar */}
                      {contribPct !== null && account.yearly_contribution_limit && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-400"
                              style={{ width: `${contribPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatCurrency(account.contributions_ytd ?? 0)} / {formatCurrency(account.yearly_contribution_limit)} this year
                          </span>
                        </div>
                      )}
                      {isRegisteredAccount(account.type) && account.contribution_room != null && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatCurrency(account.contribution_room)} room available
                        </p>
                      )}
                    </div>

                    {/* Balance */}
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-semibold ${cfg.isDebt ? 'text-rose-600' : 'text-foreground'}`}>
                        {cfg.isDebt ? '−' : ''}{formatCurrency(account.balance)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity shrink-0">
                      {isCashAccount(account.type) && (
                        <button
                          onClick={() => setAssignTarget(account)}
                          title="Assign to categories"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => { setReconcileTarget(account); setReconcileActual(String(account.balance)) }}
                        title="Adjust balance"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(account)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setArchiveTarget(account)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* ── Add / Edit Dialog ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit account' : 'Add account'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="e.g. RBC Checking, TD Visa…"
                required
                className="w-full px-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Account type *</label>
              <select
                value={form.type}
                onChange={e => handleTypeChange(e.target.value as AccountType | '')}
                required
                disabled={!!editTarget}
                className="w-full px-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 disabled:opacity-60"
              >
                <option value="">Select type…</option>
                <optgroup label="Cash">
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="cash">Cash</option>
                </optgroup>
                <optgroup label="Credit">
                  <option value="credit_card">Credit Card</option>
                  <option value="line_of_credit">Line of Credit</option>
                </optgroup>
                <optgroup label="Loans &amp; Mortgages">
                  <option value="mortgage">Mortgage</option>
                  <option value="auto_loan">Auto Loan</option>
                  <option value="student_loan">Student Loan</option>
                  <option value="personal_loan">Personal Loan</option>
                  <option value="medical_debt">Medical Debt</option>
                  <option value="other_debt">Other Debt</option>
                </optgroup>
                <optgroup label="Investments">
                  <option value="tfsa">TFSA</option>
                  <option value="fhsa">FHSA</option>
                  <option value="rrsp">RRSP</option>
                  <option value="rdsp">RDSP</option>
                  <option value="investment_other">Other Investment</option>
                </optgroup>
              </select>
              {editTarget && (
                <p className="text-xs text-muted-foreground">Account type cannot be changed after creation.</p>
              )}
            </div>

            {/* Balance */}
            {form.type && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{balanceLabel(form.type)} *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.balance}
                    onChange={e => setField('balance', e.target.value)}
                    required
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>
              </div>
            )}

            {/* Credit-specific fields */}
            {form.type && (form.type === 'credit_card' || form.type === 'line_of_credit') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Credit Limit</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.credit_limit}
                      onChange={e => setField('credit_limit', e.target.value)}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Interest Rate (%)</label>
                  <input
                    type="number" min="0" step="0.01" max="100"
                    value={form.interest_rate}
                    onChange={e => setField('interest_rate', e.target.value)}
                    placeholder="19.99"
                    className="w-full px-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>
              </div>
            )}

            {/* Loan-specific fields */}
            {form.type && isDebtAccount(form.type) && form.type !== 'credit_card' && form.type !== 'line_of_credit' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Interest Rate (% annual)</label>
                <input
                  type="number" min="0" step="0.01" max="100"
                  value={form.interest_rate}
                  onChange={e => setField('interest_rate', e.target.value)}
                  placeholder="e.g. 5.5"
                  className="w-full px-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
            )}

            {/* Payment category (new debt accounts only) */}
            {form.type && isDebtAccount(form.type) && !editTarget && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Minimum Monthly Payment</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.min_payment}
                      onChange={e => setField('min_payment', e.target.value)}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-sage-50 border border-sage-200 px-4 py-3 text-xs text-sage-700">
                  A <strong>&quot;{form.name || 'Account'} Payment&quot;</strong> category will be auto-created in Bills so you can allocate income toward this debt.
                </div>
              </>
            )}

            {/* Edit debt account: link to payment category */}
            {editTarget && isDebtAccount(form.type) && editTarget.payment_category_id && (
              <div className="rounded-lg bg-muted border border-border px-4 py-3 text-xs text-muted-foreground">
                Linked to a payment category. To update the target amount, edit it in{' '}
                <a href="/categories" className="text-sage-600 underline">Categories</a>.
              </div>
            )}

            {/* Registered account fields */}
            {form.type && isRegisteredAccount(form.type) && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {form.type === 'rdsp' ? 'Lifetime Room' : 'Available Room'} (from CRA)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={form.contribution_room}
                        onChange={e => setField('contribution_room', e.target.value)}
                        placeholder="0"
                        className="w-full pl-7 pr-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                      />
                    </div>
                  </div>
                  {form.type !== 'rdsp' && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Annual Limit</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={form.yearly_contribution_limit}
                          onChange={e => setField('yearly_contribution_limit', e.target.value)}
                          placeholder="0"
                          className="w-full pl-7 pr-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Contributed This Year</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.contributions_ytd}
                      onChange={e => setField('contributions_ytd', e.target.value)}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Any context about this account…"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : editTarget ? 'Save changes' : 'Add account'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign funds sheet */}
      <AssignFundsSheet
        account={assignTarget}
        open={!!assignTarget}
        onOpenChange={v => { if (!v) setAssignTarget(null) }}
        onDone={load}
      />

      {/* Reconcile / Adjust Balance Dialog */}
      <Dialog open={!!reconcileTarget} onOpenChange={v => { if (!v) { setReconcileTarget(null); setReconcileActual('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Balance — {reconcileTarget?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReconcile} className="space-y-4 py-2">
            <div className="rounded-lg bg-muted border border-border px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current balance</span>
                <span className="font-medium text-foreground">{reconcileTarget ? formatCurrency(reconcileTarget.balance) : '—'}</span>
              </div>
              {reconcileActual !== '' && !isNaN(parseFloat(reconcileActual)) && reconcileTarget && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Difference</span>
                  <span className={`font-medium ${parseFloat(reconcileActual) - reconcileTarget.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {parseFloat(reconcileActual) - reconcileTarget.balance >= 0 ? '+' : ''}
                    {formatCurrency(parseFloat(reconcileActual) - reconcileTarget.balance)}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Actual balance</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={reconcileActual}
                  onChange={e => setReconcileActual(e.target.value)}
                  required
                  autoFocus
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => { setReconcileTarget(null); setReconcileActual('') }}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reconciling}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {reconciling ? 'Saving…' : 'Update balance'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={v => !v && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Archive &quot;{archiveTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the account from your dashboard and net worth. Transaction history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

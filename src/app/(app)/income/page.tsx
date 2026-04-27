'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowLeft, CheckCircle, AlertTriangle, Sparkles, Calculator } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/finance'
import { GROUP_CONFIG, GROUP_ORDER } from '@/lib/group-config'
import type { AllocationSuggestion } from '@/lib/finance'
import type { Category, CategoryGroup, Account } from '@/lib/supabase/types'

type Step = 'form' | 'review' | 'success'

interface IncomeForm {
  amount: string
  gst: string
  qst: string
  account_id: string
  source: string
  received_at: string
  notes: string
}

interface AllocationRow {
  category_id: string
  name: string
  group_name: CategoryGroup
  suggested: number
  confirmed: number
  reasoning: string
  current_balance: number
  target_amount: number
}

export default function IncomePage() {
  const [step, setStep] = useState<Step>('form')
  const [taxable, setTaxable] = useState(true)
  const [form, setForm] = useState<IncomeForm>({
    amount: '',
    gst: '',
    qst: '',
    account_id: '',
    source: '',
    received_at: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [cashAccounts, setCashAccounts] = useState<Account[]>([])

  useEffect(() => {
    async function loadAccounts() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('accounts').select('*')
        .eq('user_id', user.id).eq('is_active', true)
        .in('type', ['checking', 'savings', 'cash'])
        .order('sort_order')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCashAccounts((data ?? []) as Account[])
    }
    loadAccounts()
  }, [])
  const [rows, setRows] = useState<AllocationRow[]>([])
  const [categoryMap, setCategoryMap] = useState<Map<string, Category>>(new Map())
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [allocationSource, setAllocationSource] = useState<'ai' | 'algorithm'>('algorithm')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedSource, setSavedSource] = useState('')

  function setField<K extends keyof IncomeForm>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleGetSuggestions(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/allocate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ income: netIncome, taxable }),
    })

    if (!res.ok) {
      setLoading(false)
      return
    }

    const { suggestions, categories, source, summary } = await res.json() as {
      suggestions: AllocationSuggestion[]
      categories: Category[]
      source: 'ai' | 'algorithm'
      summary: string | null
    }

    setAllocationSource(source)
    setAiSummary(summary)

    const map = new Map(categories.map((c: Category) => [c.id, c]))
    setCategoryMap(map)

    const allRows: AllocationRow[] = suggestions.map(s => {
      const cat = map.get(s.category_id)
      return {
        category_id: s.category_id,
        name: cat?.name ?? 'Unknown',
        group_name: (cat?.group_name ?? 'bills') as CategoryGroup,
        suggested: s.amount,
        confirmed: s.amount,
        reasoning: s.reasoning,
        current_balance: cat?.current_balance ?? 0,
        target_amount: cat?.target_amount ?? 0,
      }
    })

    setRows(allRows)
    setLoading(false)
    setStep('review')
  }

  function updateAmount(category_id: string, raw: string) {
    const value = parseFloat(parseFloat(raw || '0').toFixed(2))
    setRows(prev => prev.map(r => r.category_id === category_id ? { ...r, confirmed: Math.max(0, value) } : r))
  }

  const grossAmount = parseFloat(form.amount) || 0
  const gstAmount = parseFloat(form.gst) || 0
  const qstAmount = parseFloat(form.qst) || 0
  const netIncome = Math.max(0, grossAmount - gstAmount - qstAmount)
  const income = netIncome
  const totalConfirmed = rows.reduce((s, r) => s + r.confirmed, 0)
  const remaining = income - totalConfirmed
  const overAllocated = remaining < -0.01

  async function handleConfirm() {
    if (overAllocated) return
    setSaving(true)

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // 1. Insert income event (amount = net after GST/QST)
    const taxNotes = [
      gstAmount > 0 ? `GST: ${formatCurrency(gstAmount)}` : null,
      qstAmount > 0 ? `QST: ${formatCurrency(qstAmount)}` : null,
    ].filter(Boolean).join(' · ')
    const combinedNotes = [form.notes.trim(), taxNotes].filter(Boolean).join(' — ')

    const { data: event, error: eventErr } = await db
      .from('income_events')
      .insert({
        user_id: user.id,
        amount: netIncome,
        source: form.source.trim(),
        received_at: form.received_at,
        notes: combinedNotes || null,
        account_id: form.account_id || null,
      })
      .select()
      .single()

    if (eventErr || !event) { setSaving(false); return }

    // Update account balance if one was selected
    if (form.account_id) {
      const acct = cashAccounts.find(a => a.id === form.account_id)
      if (acct) {
        await db.from('accounts').update({ balance: acct.balance + netIncome }).eq('id', form.account_id)
      }
    }

    // 2. For each non-zero allocation: save + update balance + log transaction
    for (const row of rows.filter(r => r.confirmed > 0)) {
      const cat = categoryMap.get(row.category_id)
      if (!cat) continue

      const { data: alloc } = await db
        .from('allocations')
        .insert({
          income_event_id: event.id,
          category_id: row.category_id,
          suggested_amount: row.suggested,
          confirmed_amount: row.confirmed,
        })
        .select()
        .single()

      await db
        .from('categories')
        .update({ current_balance: cat.current_balance + row.confirmed })
        .eq('id', row.category_id)

      await db.from('transactions').insert({
        user_id: user.id,
        category_id: row.category_id,
        amount: row.confirmed,
        description: `Income: ${form.source.trim()}`,
        date: form.received_at,
        allocation_id: alloc ? alloc.id : null,
      })
    }

    setSavedSource(form.source.trim())
    setSaving(false)
    setStep('success')
  }

  // ── Step 1: Income form ───────────────────────────────────────────
  if (step === 'form') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Add Income</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Enter a payment received to get allocation suggestions
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <form onSubmit={handleGetSuggestions} className="space-y-5">
            {/* Amount */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Amount (CAD) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setField('amount', e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
            </div>

            {/* Taxable toggle */}
            <div className="flex items-center justify-between py-0.5">
              <div>
                <p className="text-sm font-medium text-foreground">Taxable income</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {taxable ? 'Tax carve-out will apply' : 'Tax carve-out will be skipped'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTaxable(v => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sage-500 focus:ring-offset-2 ${
                  taxable ? 'bg-sage-600' : 'bg-muted border border-border'
                }`}
                aria-pressed={taxable}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    taxable ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* GST / QST */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  GST <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.gst}
                    onChange={e => setField('gst', e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  QST <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.qst}
                    onChange={e => setField('qst', e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>
              </div>
            </div>

            {/* Net income breakdown */}
            {(gstAmount > 0 || qstAmount > 0) && (
              <div className="rounded-lg bg-muted border border-border px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross amount</span>
                  <span>{formatCurrency(grossAmount)}</span>
                </div>
                {gstAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>− GST</span>
                    <span>{formatCurrency(gstAmount)}</span>
                  </div>
                )}
                {qstAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>− QST</span>
                    <span>{formatCurrency(qstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-border pt-2 mt-1 text-foreground">
                  <span>Net income (to allocate)</span>
                  <span>{formatCurrency(netIncome)}</span>
                </div>
              </div>
            )}

            {/* Destination account */}
            {cashAccounts.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Destination account <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <select
                  value={form.account_id}
                  onChange={e => setField('account_id', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                >
                  <option value="">Not tracked</option>
                  {cashAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {formatCurrency(a.balance)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Source */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Source *</label>
              <input
                type="text"
                value={form.source}
                onChange={e => setField('source', e.target.value)}
                placeholder="Client name, invoice #, employer…"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Date received *</label>
              <input
                type="date"
                value={form.received_at}
                onChange={e => setField('received_at', e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Project name, context…"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? 'Calculating…' : <> Get allocation suggestions <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Step 2: Allocation review ─────────────────────────────────────
  if (step === 'review') {
    const byGroup = GROUP_ORDER.reduce<Record<string, AllocationRow[]>>((acc, g) => {
      acc[g] = rows.filter(r => r.group_name === g)
      return acc
    }, {} as Record<string, AllocationRow[]>)

    return (
      <div className="max-w-2xl mx-auto pb-36">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Review Allocation</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {gstAmount > 0 || qstAmount > 0 ? (
                <>
                  <span>{formatCurrency(netIncome)} net</span>
                  <span className="text-xs"> (gross {formatCurrency(grossAmount)})</span>
                </>
              ) : formatCurrency(income)}{' '}
              from <strong className="text-foreground">{form.source}</strong>
              {' · '}{new Date(form.received_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
              {!taxable && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Non-taxable
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setStep('form')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {/* AI summary or algorithm badge */}
        {allocationSource === 'ai' && aiSummary ? (
          <div className="flex gap-3 p-4 rounded-xl bg-sage-100 border border-sage-200 mb-6">
            <Sparkles className="w-4 h-4 text-sage-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-sage-700 uppercase tracking-wide mb-0.5">
                Claude AI suggestion
              </p>
              <p className="text-sm text-sage-800">{aiSummary}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border mb-6 text-xs text-muted-foreground">
            <Calculator className="w-3.5 h-3.5 shrink-0" />
            Calculated by built-in algorithm — add <code className="font-mono bg-background px-1 rounded">ANTHROPIC_API_KEY</code> to Vercel for AI suggestions
          </div>
        )}

        {/* Rows grouped */}
        <div className="space-y-6">
          {GROUP_ORDER.map(group => {
            const groupRows = byGroup[group as CategoryGroup]
            if (!groupRows?.length) return null
            const cfg = GROUP_CONFIG[group as CategoryGroup]

            return (
              <section key={group}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(groupRows.reduce((s, r) => s + r.confirmed, 0))} allocated
                  </span>
                </div>

                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  {groupRows.map((row, idx) => {
                    const newBalance = row.current_balance + row.confirmed
                    const pct = row.target_amount > 0 ? Math.min(100, Math.round((newBalance / row.target_amount) * 100)) : null
                    const isLast = idx === groupRows.length - 1

                    return (
                      <div
                        key={row.category_id}
                        className={`flex items-center gap-4 px-4 py-3.5 ${!isLast ? 'border-b border-border' : ''}`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />

                        {/* Category info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{row.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{row.reasoning}</p>
                          {pct !== null && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: pct >= 75 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#F43F5E',
                                  }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatCurrency(newBalance)} / {formatCurrency(row.target_amount)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Editable amount */}
                        <div className="relative shrink-0">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.confirmed || ''}
                            onChange={e => updateAmount(row.category_id, e.target.value)}
                            className="w-28 pl-7 pr-2 py-1.5 rounded-lg border border-sage-200 bg-background text-sm text-right focus:outline-none focus:ring-2 focus:ring-sage-500"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        {/* Sticky footer */}
        <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-background border-t border-border px-4 py-4 z-10">
          <div className="max-w-2xl mx-auto">
            {/* Summary bar */}
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-muted-foreground">
                Allocated <strong className="text-foreground">{formatCurrency(totalConfirmed)}</strong> of{' '}
                <strong className="text-foreground">{formatCurrency(income)}</strong>
              </span>
              {overAllocated && (
                <span className="flex items-center gap-1 text-destructive font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  Over by {formatCurrency(Math.abs(remaining))}
                </span>
              )}
              {!overAllocated && remaining > 0.01 && (
                <span className="text-amber-600 font-medium">
                  {formatCurrency(remaining)} unallocated
                </span>
              )}
              {!overAllocated && remaining <= 0.01 && (
                <span className="text-emerald-600 font-medium">Fully allocated</span>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (totalConfirmed / income) * 100)}%`,
                  backgroundColor: overAllocated ? '#F43F5E' : totalConfirmed >= income * 0.99 ? '#10B981' : '#F59E0B',
                }}
              />
            </div>

            <button
              onClick={handleConfirm}
              disabled={saving || overAllocated}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : <> Confirm & apply <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3: Success ───────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto text-center py-20">
      <CheckCircle className="w-16 h-16 text-sage-500 mx-auto mb-6" />
      <h1 className="text-2xl font-bold text-foreground mb-2">Income allocated!</h1>
      <p className="text-muted-foreground mb-2">
        <strong className="text-foreground">{formatCurrency(income)}</strong> from{' '}
        <strong className="text-foreground">{savedSource}</strong> has been distributed across{' '}
        {rows.filter(r => r.confirmed > 0).length} categories.
      </p>
      <p className="text-muted-foreground text-sm mb-8">
        Your category balances have been updated.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          View Dashboard
        </Link>
        <button
          onClick={() => {
            setStep('form')
            setForm({ amount: '', gst: '', qst: '', account_id: '', source: '', received_at: new Date().toISOString().split('T')[0], notes: '' })
            setTaxable(true)
            setRows([])
          }}
          className="px-5 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
        >
          Add another
        </button>
      </div>
    </div>
  )
}

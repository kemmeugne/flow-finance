'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/finance'
import { GROUP_CONFIG, GROUP_ORDER } from '@/lib/group-config'
import type { AllocationSuggestion } from '@/lib/finance'
import type { Category, CategoryGroup } from '@/lib/supabase/types'

type Step = 'form' | 'review' | 'success'

interface IncomeForm {
  amount: string
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
  const [form, setForm] = useState<IncomeForm>({
    amount: '',
    source: '',
    received_at: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [rows, setRows] = useState<AllocationRow[]>([])
  const [categoryMap, setCategoryMap] = useState<Map<string, Category>>(new Map())
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
      body: JSON.stringify({ income: parseFloat(form.amount) }),
    })

    if (!res.ok) {
      setLoading(false)
      return
    }

    const { suggestions, categories } = await res.json() as {
      suggestions: AllocationSuggestion[]
      categories: Category[]
    }

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
    const value = Math.max(0, parseFloat(raw) || 0)
    setRows(prev => prev.map(r => r.category_id === category_id ? { ...r, confirmed: value } : r))
  }

  const income = parseFloat(form.amount) || 0
  const totalConfirmed = rows.reduce((s, r) => s + r.confirmed, 0)
  const remaining = income - totalConfirmed
  const overAllocated = remaining < -0.5

  async function handleConfirm() {
    if (overAllocated) return
    setSaving(true)

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // 1. Insert income event
    const { data: event, error: eventErr } = await db
      .from('income_events')
      .insert({
        user_id: user.id,
        amount: income,
        source: form.source.trim(),
        received_at: form.received_at,
        notes: form.notes.trim() || null,
      })
      .select()
      .single()

    if (eventErr || !event) { setSaving(false); return }

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
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Review Allocation</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {formatCurrency(income)} from <strong className="text-foreground">{form.source}</strong>
              {' · '}{new Date(form.received_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={() => setStep('form')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

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
                            step="1"
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
              {!overAllocated && remaining > 0.5 && (
                <span className="text-amber-600 font-medium">
                  {formatCurrency(remaining)} unallocated
                </span>
              )}
              {!overAllocated && remaining <= 0.5 && (
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
            setForm({ amount: '', source: '', received_at: new Date().toISOString().split('T')[0], notes: '' })
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

'use client'

import { useState } from 'react'
import { ArrowRight, ArrowLeft, CheckCircle, AlertTriangle, Sparkles, Calculator } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/finance'
import { GROUP_CONFIG, GROUP_ORDER } from '@/lib/group-config'
import type { AllocationSuggestion } from '@/lib/finance'
import type { Category, CategoryGroup, Account } from '@/lib/supabase/types'

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

interface Props {
  account: Account | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}

export function AssignFundsSheet({ account, open, onOpenChange, onDone }: Props) {
  const [step, setStep] = useState<'amount' | 'review' | 'done'>('amount')
  const [amount, setAmount] = useState('')
  const [rows, setRows] = useState<AllocationRow[]>([])
  const [categoryMap, setCategoryMap] = useState<Map<string, Category>>(new Map())
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [allocationSource, setAllocationSource] = useState<'ai' | 'algorithm'>('algorithm')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  function handleOpenChange(v: boolean) {
    if (v && account) {
      setAmount(String(account.balance))
      setStep('amount')
      setRows([])
    }
    onOpenChange(v)
  }

  const assignAmount = parseFloat(amount) || 0
  const totalConfirmed = rows.reduce((s, r) => s + r.confirmed, 0)
  const remaining = assignAmount - totalConfirmed
  const overAllocated = remaining < -0.01

  async function getSuggestions(e: React.FormEvent) {
    e.preventDefault()
    if (assignAmount <= 0) return
    setLoading(true)

    const res = await fetch('/api/allocate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ income: assignAmount, taxable: false }),
    })

    if (!res.ok) { setLoading(false); return }

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

    setRows(suggestions.map(s => {
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
    }))
    setLoading(false)
    setStep('review')
  }

  function updateAmount(category_id: string, raw: string) {
    const value = parseFloat(parseFloat(raw || '0').toFixed(2))
    setRows(prev => prev.map(r =>
      r.category_id === category_id ? { ...r, confirmed: Math.max(0, value) } : r
    ))
  }

  async function handleConfirm() {
    if (overAllocated) return
    setSaving(true)

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    for (const row of rows.filter(r => r.confirmed > 0)) {
      const cat = categoryMap.get(row.category_id)
      if (!cat) continue
      await db
        .from('categories')
        .update({ current_balance: cat.current_balance + row.confirmed })
        .eq('id', row.category_id)
    }

    setSaving(false)
    setStep('done')
    setTimeout(() => {
      onOpenChange(false)
      onDone()
    }, 1400)
  }

  const funded = rows.filter(r => r.confirmed > 0).length

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col overflow-y-auto">
        <SheetHeader className="border-b border-border px-6 py-5 shrink-0">
          <SheetTitle className="text-lg">
            Assign funds from {account?.name ?? ''}
          </SheetTitle>
        </SheetHeader>

        {/* ── Step 1: Amount ── */}
        {step === 'amount' && (
          <form onSubmit={getSuggestions} className="flex flex-col flex-1 px-6 py-6 space-y-5">
            <div className="rounded-lg bg-muted border border-border px-4 py-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Available</span>
              <span className="font-semibold text-foreground">
                {account ? formatCurrency(account.balance) : '—'}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Amount to assign *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  autoFocus
                  className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This funds your budget categories — the account balance stays unchanged.
              </p>
            </div>

            <div className="flex-1" />

            <button
              type="submit"
              disabled={loading || assignAmount <= 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? 'Calculating…' : <><span>Get suggestions</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        {/* ── Step 2: Review ── */}
        {step === 'review' && (
          <div className="flex flex-col flex-1 px-6 py-6 min-h-0">
            <button
              onClick={() => setStep('amount')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 self-start shrink-0"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            {allocationSource === 'ai' && aiSummary ? (
              <div className="flex gap-3 p-4 rounded-xl bg-sage-100 border border-sage-200 mb-4 shrink-0">
                <Sparkles className="w-4 h-4 text-sage-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-sage-700 uppercase tracking-wide mb-0.5">Claude AI suggestion</p>
                  <p className="text-sm text-sage-800">{aiSummary}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border mb-4 text-xs text-muted-foreground shrink-0">
                <Calculator className="w-3.5 h-3.5 shrink-0" />
                Built-in algorithm
              </div>
            )}

            {/* Scrollable allocation rows */}
            <div className="space-y-4 flex-1 overflow-y-auto pb-4">
              {GROUP_ORDER.map(group => {
                const groupRows = rows.filter(r => r.group_name === group)
                if (!groupRows.length) return null
                const cfg = GROUP_CONFIG[group as CategoryGroup]
                return (
                  <section key={group}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                      {groupRows.map((row, idx) => {
                        const isLast = idx === groupRows.length - 1
                        const newBalance = row.current_balance + row.confirmed
                        const pct = row.target_amount > 0
                          ? Math.min(100, Math.round((newBalance / row.target_amount) * 100))
                          : null
                        return (
                          <div
                            key={row.category_id}
                            className={`flex items-center gap-3 px-4 py-3 ${!isLast ? 'border-b border-border' : ''}`}
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{row.name}</p>
                              <p className="text-xs text-muted-foreground">{row.reasoning}</p>
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
                            <div className="relative shrink-0">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.confirmed || ''}
                                onChange={e => updateAmount(row.category_id, e.target.value)}
                                className="w-24 pl-5 pr-2 py-1.5 rounded-lg border border-sage-200 bg-background text-sm text-right focus:outline-none focus:ring-2 focus:ring-sage-500"
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

            {/* Sticky summary + confirm */}
            <div className="border-t border-border pt-4 shrink-0 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{formatCurrency(totalConfirmed)}</strong>
                  {' '}of{' '}
                  <strong className="text-foreground">{formatCurrency(assignAmount)}</strong>
                </span>
                {overAllocated && (
                  <span className="flex items-center gap-1 text-destructive font-medium text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Over by {formatCurrency(Math.abs(remaining))}
                  </span>
                )}
                {!overAllocated && remaining > 0.01 && (
                  <span className="text-amber-600 font-medium text-xs">{formatCurrency(remaining)} unallocated</span>
                )}
                {!overAllocated && remaining <= 0.01 && (
                  <span className="text-emerald-600 font-medium text-xs">Fully allocated</span>
                )}
              </div>

              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (totalConfirmed / assignAmount) * 100)}%`,
                    backgroundColor: overAllocated ? '#F43F5E' : totalConfirmed >= assignAmount * 0.99 ? '#10B981' : '#F59E0B',
                  }}
                />
              </div>

              <button
                onClick={handleConfirm}
                disabled={saving || overAllocated}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : <><span>Confirm & apply</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6">
            <CheckCircle className="w-12 h-12 text-sage-500" />
            <p className="text-sm font-medium text-foreground">Funds assigned!</p>
            <p className="text-xs text-muted-foreground text-center">
              {formatCurrency(assignAmount)} from {account?.name} distributed across {funded} {funded === 1 ? 'category' : 'categories'}.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

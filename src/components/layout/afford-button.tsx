'use client'

import { useState } from 'react'
import { HelpCircle, CheckCircle, AlertTriangle, XCircle, Loader2, Sparkles } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatCurrency } from '@/lib/finance'
import type { AffordResult } from '@/app/api/afford/route'

const VERDICT_CONFIG = {
  yes: {
    icon: CheckCircle,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    headlineColor: 'text-emerald-800',
    textColor: 'text-emerald-700',
    label: 'Yes, you can afford it',
  },
  caution: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-600',
    headlineColor: 'text-amber-800',
    textColor: 'text-amber-700',
    label: 'Proceed with caution',
  },
  no: {
    icon: XCircle,
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    iconColor: 'text-rose-600',
    headlineColor: 'text-rose-800',
    textColor: 'text-rose-700',
    label: 'Not recommended right now',
  },
}

export function AffordButton() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ amount: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AffordResult | null>(null)

  function reset() {
    setForm({ amount: '', description: '' })
    setResult(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const res = await fetch('/api/afford', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(form.amount), description: form.description.trim() }),
    })
    const data: AffordResult = await res.json()
    setResult(data)
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
        Can I afford this?
      </button>

      <Sheet open={open} onOpenChange={v => { setOpen(v); if (!v) reset() }}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col overflow-y-auto">
          <SheetHeader className="border-b border-border px-6 py-5">
            <SheetTitle className="text-lg">Can I afford this?</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col flex-1 px-6 py-6 space-y-5">

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Amount (CAD) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                    className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">What is it for? *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. New laptop, weekend trip, car repair…"
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking with AI…</>
                  : <><Sparkles className="w-4 h-4" /> Ask Claude</>
                }
              </button>
            </form>

            {/* Result */}
            {result && (() => {
              const cfg = VERDICT_CONFIG[result.verdict]
              const Icon = cfg.icon
              return (
                <div className={`rounded-xl border p-4 space-y-3 ${cfg.bg} ${cfg.border}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${cfg.iconColor}`} />
                    <div>
                      <p className={`text-sm font-semibold ${cfg.headlineColor}`}>{result.headline}</p>
                      <p className={`text-xs mt-1 leading-relaxed ${cfg.textColor}`}>{result.reasoning}</p>
                    </div>
                  </div>

                  {result.suggested_category && (
                    <div className={`pt-3 border-t ${cfg.border}`}>
                      <p className={`text-xs font-medium ${cfg.textColor}`}>
                        Take it from:{' '}
                        <span className="font-semibold">{result.suggested_category}</span>
                        {result.balance_after !== null && (
                          <span className="font-normal">
                            {' '}→ {formatCurrency(result.balance_after)} remaining
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Ask again */}
            {result && (
              <button
                onClick={reset}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Check another amount
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

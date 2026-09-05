'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'

const CONFIRM_WORD = 'RESET'

type Counts = {
  categories: number
  accounts: number
  income_events: number
  transactions: number
  account_transfers: number
}

export function ResetDataButton() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [typed, setTyped] = useState('')
  const [reseed, setReseed] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const loadCounts = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const table = (name: string) =>
      supabase.from(name).select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    const [cat, acc, inc, tx, tr] = await Promise.all([
      table('categories'), table('accounts'), table('income_events'),
      table('transactions'), table('account_transfers'),
    ])
    setCounts({
      categories: cat.count ?? 0,
      accounts: acc.count ?? 0,
      income_events: inc.count ?? 0,
      transactions: tx.count ?? 0,
      account_transfers: tr.count ?? 0,
    })
  }, [])

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (v) {
      setStep(1)
      setTyped('')
      setReseed(true)
      setError(null)
      loadCounts()
    }
  }

  async function handleReset() {
    if (typed.trim().toUpperCase() !== CONFIRM_WORD) return
    setWorking(true)
    setError(null)

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setWorking(false); return }

    // Order matters: children before parents.
    // Deleting income_events cascades to allocations; deleting accounts
    // nulls out payment_category_id links on categories.
    const steps = [
      'account_transfers',
      'transactions',
      'income_events',
      'accounts',
      'categories',
    ]

    for (const table of steps) {
      const { error: err } = await db.from(table).delete().eq('user_id', user.id)
      if (err) {
        setError(`Could not clear ${table.replace('_', ' ')}: ${err.message}`)
        setWorking(false)
        return
      }
    }

    if (reseed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: err } = await (supabase.rpc as any)('seed_default_categories', { p_user_id: user.id })
      if (err) {
        setError(`Data was erased, but the default categories could not be restored: ${err.message}`)
        setWorking(false)
        return
      }
    }

    setWorking(false)
    setOpen(false)
    router.refresh()
  }

  const total = counts
    ? counts.categories + counts.accounts + counts.income_events + counts.transactions + counts.account_transfers
    : null

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 bg-card text-rose-700 text-xs font-medium hover:bg-rose-50 transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Reset all data
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          {step === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  Reset all your data?
                </DialogTitle>
                <DialogDescription>
                  This erases your entire financial plan so you can start over from scratch.
                  It cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 space-y-1.5 text-xs">
                <p className="font-semibold text-rose-800">This will permanently delete:</p>
                {counts ? (
                  <ul className="space-y-1 text-rose-700">
                    <CountRow label="Categories and their balances" n={counts.categories} />
                    <CountRow label="Accounts" n={counts.accounts} />
                    <CountRow label="Income events and their allocations" n={counts.income_events} />
                    <CountRow label="Transactions" n={counts.transactions} />
                    <CountRow label="Account transfers" n={counts.account_transfers} />
                  </ul>
                ) : (
                  <p className="text-rose-700">Counting your records…</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Your account, password and tax settings are kept — only your financial data is erased.
              </p>

              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={total === null}
                  className="px-4 py-2 rounded-lg bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60"
                >
                  Continue
                </button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-500" />
                  Last chance — confirm the reset
                </DialogTitle>
                <DialogDescription>
                  {total === 0
                    ? 'You have no data to erase yet.'
                    : `${total} records will be deleted forever. There is no way to recover them.`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Type <span className="font-mono font-bold">{CONFIRM_WORD}</span> to confirm
                </label>
                <input
                  autoFocus
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  className="w-full px-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={reseed}
                  onChange={e => setReseed(e.target.checked)}
                  className="mt-0.5 accent-sage-600 cursor-pointer"
                />
                <span>
                  Restore the default starter categories afterwards, so you begin with a fresh
                  budget instead of an empty app.
                </span>
              </label>

              {error && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{error}</p>
              )}

              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={working}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={working || typed.trim().toUpperCase() !== CONFIRM_WORD}
                  className="px-4 py-2 rounded-lg bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-40"
                >
                  {working ? 'Erasing…' : 'Delete everything'}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function CountRow({ label, n }: { label: string; n: number }) {
  return (
    <li className="flex justify-between gap-4">
      <span>{label}</span>
      <span className="font-semibold shrink-0">{n}</span>
    </li>
  )
}

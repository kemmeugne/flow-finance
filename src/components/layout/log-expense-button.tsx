'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MinusCircle, CheckCircle } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/finance'
import { GROUP_CONFIG, GROUP_ORDER } from '@/lib/group-config'
import type { Category, CategoryGroup } from '@/lib/supabase/types'

export function LogExpenseButton() {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({
    category_id: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  const loadCategories = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('categories').select('*')
      .eq('user_id', user!.id).eq('is_active', true)
      .order('group_name').order('sort_order')
    setCategories((data ?? []) as Category[])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && categories.length === 0) loadCategories()
  }, [open, loadCategories, categories.length])

  function resetForm() {
    setForm({ category_id: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] })
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

    await db.from('transactions').insert({
      user_id: user.id,
      category_id: form.category_id,
      amount: -amount,
      description: form.description.trim(),
      date: form.date,
      allocation_id: null,
    })

    await db.from('categories')
      .update({ current_balance: cat.current_balance - amount })
      .eq('id', form.category_id)

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
              <p className="text-sm font-medium text-foreground">Expense logged!</p>
              <p className="text-xs text-muted-foreground">Balance updated.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 px-6 py-6 space-y-5">

              {/* Category */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Category *</label>
                <select
                  value={form.category_id}
                  onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
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
                    <span className="font-medium text-foreground">
                      {formatCurrency(selectedCat.current_balance)}
                    </span>
                    {form.amount && parseFloat(form.amount) > 0 && (
                      <> → <span className={selectedCat.current_balance - parseFloat(form.amount) < 0 ? 'text-destructive font-medium' : 'font-medium'}>
                        {formatCurrency(selectedCat.current_balance - parseFloat(form.amount))}
                      </span></>
                    )}
                  </p>
                )}
              </div>

              {/* Amount */}
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
                {saving ? 'Saving…' : 'Log expense'}
              </button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

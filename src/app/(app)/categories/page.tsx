'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/finance'
import { GROUP_CONFIG, GROUP_ORDER } from '@/lib/group-config'
import type { Category, CategoryGroup, DueFrequency } from '@/lib/supabase/types'

interface FormState {
  name: string
  group_name: CategoryGroup
  target_amount: string
  current_balance: string
  priority: string
  due_date: string
  due_frequency: DueFrequency
  notes: string
}

const EMPTY_FORM: FormState = {
  name: '',
  group_name: 'bills',
  target_amount: '',
  current_balance: '0',
  priority: '3',
  due_date: '',
  due_frequency: 'monthly',
  notes: '',
}

const PRIORITY_LABELS: Record<string, string> = {
  '1': '1 — Critical',
  '2': '2 — Important',
  '3': '3 — Normal',
  '4': '4 — Nice to have',
  '5': '5 — Optional',
}

const FREQUENCY_LABELS: Record<DueFrequency, string> = {
  monthly:   'Monthly',
  quarterly: 'Quarterly',
  annual:    'Annual',
  one_time:  'One time',
  none:      'No due date',
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('categories').select('*')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .order('group_name').order('sort_order')
    setCategories((data ?? []) as Category[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(cat: Category) {
    setEditTarget(cat)
    setForm({
      name: cat.name,
      group_name: cat.group_name as CategoryGroup,
      target_amount: String(cat.target_amount),
      current_balance: String(cat.current_balance),
      priority: String(cat.priority),
      due_date: cat.due_date ?? '',
      due_frequency: cat.due_frequency as DueFrequency,
      notes: cat.notes ?? '',
    })
    setDialogOpen(true)
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      name: form.name.trim(),
      group_name: form.group_name,
      target_amount: parseFloat(form.target_amount) || 0,
      current_balance: parseFloat(form.current_balance) || 0,
      priority: parseInt(form.priority),
      due_date: form.due_date || null,
      due_frequency: form.due_frequency,
      notes: form.notes.trim() || null,
      is_active: true,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    if (editTarget) {
      await db.from('categories').update(payload).eq('id', editTarget.id)
    } else {
      const maxOrder = categories
        .filter(c => c.group_name === form.group_name)
        .reduce((m, c) => Math.max(m, c.sort_order), -1)
      await db.from('categories').insert({ ...payload, user_id: user!.id, sort_order: maxOrder + 1 })
    }

    setSaving(false)
    setDialogOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('categories').update({ is_active: false }).eq('id', deleteTarget.id)
    setDeleteTarget(null)
    load()
  }

  const byGroup = GROUP_ORDER.reduce<Record<string, Category[]>>((acc, g) => {
    acc[g] = categories.filter(c => c.group_name === g)
    return acc
  }, {} as Record<string, Category[]>)

  const fundedPct = (cat: Category) =>
    cat.target_amount > 0 ? Math.min(100, Math.round((cat.current_balance / cat.target_amount) * 100)) : null

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{categories.length} active budget buckets</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Group sections */}
      {!loading && GROUP_ORDER.map(group => {
        const items = byGroup[group as CategoryGroup]
        if (!items?.length) return null
        const cfg = GROUP_CONFIG[group as CategoryGroup]
        const groupTotal = items.reduce((s, c) => s + c.current_balance, 0)

        return (
          <section key={group}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
                {cfg.label}
              </span>
              <span className="text-xs text-muted-foreground">{formatCurrency(groupTotal)} funded</span>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {items.map((cat, idx) => {
                const pct = fundedPct(cat)
                const isLast = idx === items.length - 1

                return (
                  <div
                    key={cat.id}
                    className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors group ${!isLast ? 'border-b border-border' : ''}`}
                  >
                    {/* Color dot */}
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />

                    {/* Name + progress */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{cat.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          P{cat.priority}
                        </span>
                        {cat.due_date && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            Due {new Date(cat.due_date!).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      {pct !== null && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: pct >= 75 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#F43F5E',
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatCurrency(cat.current_balance)} / {formatCurrency(cat.target_amount)}
                          </span>
                        </div>
                      )}
                      {pct === null && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatCurrency(cat.current_balance)} · no target
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
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

      {/* Empty state */}
      {!loading && categories.length === 0 && (
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">No categories yet.</p>
          <button onClick={openAdd} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            Add your first category
          </button>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit category' : 'Add category'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="e.g. Rent, Emergency Fund…"
                required
                className="w-full px-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              />
            </div>

            {/* Group + Priority row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Group *</label>
                <Select value={form.group_name} onValueChange={v => v && setField('group_name', v as CategoryGroup)}>
                  <SelectTrigger className="border-sage-200 focus:ring-sage-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_ORDER.map(g => (
                      <SelectItem key={g} value={g}>{GROUP_CONFIG[g as CategoryGroup].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Priority *</label>
                <Select value={form.priority} onValueChange={v => v && setField('priority', v)}>
                  <SelectTrigger className="border-sage-200 focus:ring-sage-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Target + Balance row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Target amount (CAD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.target_amount}
                  onChange={e => setField('target_amount', e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {editTarget ? 'Current balance' : 'Opening balance'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.current_balance}
                  onChange={e => setField('current_balance', e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
            </div>

            {/* Due date + Frequency row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Due date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setField('due_date', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Frequency</label>
                <Select value={form.due_frequency} onValueChange={v => v && setField('due_frequency', v as DueFrequency)}>
                  <SelectTrigger className="border-sage-200 focus:ring-sage-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(FREQUENCY_LABELS) as [DueFrequency, string][]).map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Any context about this category…"
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
                {saving ? 'Saving…' : editTarget ? 'Save changes' : 'Add category'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Archive "{deleteTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the category from your dashboard and allocation screen. Your balance history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

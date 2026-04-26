import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/finance'
import { Target, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import type { Category } from '@/lib/supabase/types'

function monthsUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const now = new Date()
  const months = (due.getFullYear() - now.getFullYear()) * 12 + (due.getMonth() - now.getMonth())
  return Math.max(1, months)
}

export default async function GoalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .eq('group_name', 'goals')
    .order('sort_order')

  const goals: Category[] = (data ?? []) as Category[]

  const totalSaved = goals.reduce((s, g) => s + g.current_balance, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0)
  const completed = goals.filter(g => g.target_amount > 0 && g.current_balance >= g.target_amount).length

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Goals</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track progress toward your financial goals</p>
        </div>
        <Link
          href="/categories"
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors shrink-0"
        >
          Manage goals
        </Link>
      </div>

      {/* Summary */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Total Saved</p>
            <p className="text-xl font-bold text-violet-600">{formatCurrency(totalSaved)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">of {formatCurrency(totalTarget)}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Goals</p>
            <p className="text-xl font-bold text-foreground">{goals.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">active</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Completed</p>
            <p className="text-xl font-bold text-emerald-600">{completed}</p>
            <p className="text-xs text-muted-foreground mt-0.5">fully funded</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {goals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground">No goals yet</h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            Add categories in the &quot;Goals&quot; group from the Categories page to track them here.
          </p>
          <Link
            href="/categories"
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Add a goal
          </Link>
        </div>
      )}

      {/* Goals grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map(goal => {
          const pct = goal.target_amount > 0
            ? Math.min(100, Math.round((goal.current_balance / goal.target_amount) * 100))
            : 0
          const deficit = Math.max(0, goal.target_amount - goal.current_balance)
          const months = monthsUntilDue(goal.due_date)
          const monthlyNeeded = months && deficit > 0 ? Math.ceil(deficit / months) : null
          const isComplete = pct >= 100

          return (
            <div
              key={goal.id}
              className="bg-card rounded-xl border border-border border-l-4 border-l-violet-400 p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{goal.name}</h3>
                  {goal.due_date && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Target: {new Date(goal.due_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <span className={`text-lg font-bold shrink-0 ${isComplete ? 'text-emerald-600' : 'text-violet-600'}`}>
                  {pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isComplete ? '#10B981' : '#8B5CF6',
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-sm font-medium text-foreground">{formatCurrency(goal.current_balance)}</span>
                  <span className="text-sm text-muted-foreground">of {formatCurrency(goal.target_amount)}</span>
                </div>
              </div>

              {/* Status callout */}
              {isComplete ? (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <p className="text-xs font-medium text-emerald-700">Goal reached! 🎉</p>
                </div>
              ) : monthlyNeeded ? (
                <div className="p-3 rounded-lg bg-violet-50 border border-violet-100">
                  <p className="text-xs font-medium text-violet-700">
                    {formatCurrency(monthlyNeeded)}/month needed
                  </p>
                  <p className="text-xs text-violet-500 mt-0.5">
                    {formatCurrency(deficit)} remaining · {months} month{months !== 1 ? 's' : ''} to go
                  </p>
                </div>
              ) : deficit > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(deficit)} remaining
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

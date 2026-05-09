'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Save } from 'lucide-react'

export default function SettingsPage() {
  const [federalPct, setFederalPct] = useState(15)
  const [provincialPct, setProvincialPct] = useState(12)
  const [currency, setCurrency] = useState('CAD')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = data as any
        setFederalPct(s.federal_tax_percent ?? 15)
        setProvincialPct(s.provincial_tax_percent ?? 12)
        setCurrency(s.currency ?? 'CAD')
      }
      setLoading(false)
    }
    loadSettings()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    await db.from('user_settings')
      .update({
        federal_tax_percent: federalPct,
        provincial_tax_percent: provincialPct,
        tax_carveout_percent: federalPct + provincialPct,
        currency,
      })
      .eq('user_id', user.id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
    )
  }

  const exampleIncome = 5000
  const federalReserved = Math.round(exampleIncome * federalPct / 100)
  const provincialReserved = Math.round(exampleIncome * provincialPct / 100)
  const totalTaxReserved = federalReserved + provincialReserved
  const toAllocate = exampleIncome - totalTaxReserved

  return (
    <div className="space-y-8 max-w-xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Configure your budget preferences</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {/* Tax carve-out */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-0.5">Income Tax Carve-out</h2>
          <p className="text-xs text-muted-foreground mb-5">
            Set separate percentages for federal and provincial income tax. These amounts are reserved
            first from each taxable income event and routed to your Federal and Provincial Income Tax categories.
          </p>

          <div className="space-y-5">
            {/* Federal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Federal Income Tax</label>
                <span className="text-xs text-muted-foreground">Canada: 15–33%</span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={0.5}
                  value={federalPct}
                  onChange={e => setFederalPct(Number(e.target.value))}
                  className="flex-1 h-1.5 accent-sage-600 cursor-pointer"
                />
                <div className="relative shrink-0 w-20">
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step={0.5}
                    value={federalPct}
                    onChange={e => setFederalPct(Math.min(40, Math.max(0, Number(e.target.value))))}
                    className="w-full px-3 py-2 pr-6 rounded-lg border border-sage-200 bg-background text-sm text-right focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Provincial */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Provincial Income Tax</label>
                <span className="text-xs text-muted-foreground">Canada: 5–25%</span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={0.5}
                  value={provincialPct}
                  onChange={e => setProvincialPct(Number(e.target.value))}
                  className="flex-1 h-1.5 accent-sage-600 cursor-pointer"
                />
                <div className="relative shrink-0 w-20">
                  <input
                    type="number"
                    min={0}
                    max={25}
                    step={0.5}
                    value={provincialPct}
                    onChange={e => setProvincialPct(Math.min(25, Math.max(0, Number(e.target.value))))}
                    className="w-full px-3 py-2 pr-6 rounded-lg border border-sage-200 bg-background text-sm text-right focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Example breakdown */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1.5 text-xs">
              <p className="text-muted-foreground font-medium">
                On a <span className="text-foreground">{formatCAD(exampleIncome)}</span> income:
              </p>
              <div className="flex justify-between text-muted-foreground">
                <span>Federal income tax ({federalPct}%)</span>
                <span className="text-foreground">→ {formatCAD(federalReserved)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Provincial income tax ({provincialPct}%)</span>
                <span className="text-foreground">→ {formatCAD(provincialReserved)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-1.5 mt-1 text-foreground">
                <span>Total taxes reserved ({federalPct + provincialPct}%)</span>
                <span>{formatCAD(totalTaxReserved)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Available to allocate</span>
                <span>{formatCAD(toAllocate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Currency */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-0.5">Currency</h2>
          <p className="text-xs text-muted-foreground mb-4">Display currency for all amounts.</p>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-sage-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
          >
            <option value="CAD">CAD — Canadian Dollar</option>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
          </select>
        </div>

        {/* Save */}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {saved ? (
            <><CheckCircle className="w-4 h-4" /> Saved</>
          ) : (
            <><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save settings'}</>
          )}
        </button>
      </form>
    </div>
  )
}

function formatCAD(n: number) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
}

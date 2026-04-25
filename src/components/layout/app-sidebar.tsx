'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Tags,
  PlusCircle,
  Target,
  LogOut,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/categories', label: 'Categories',  icon: Tags },
  { href: '/income',     label: 'Add Income',  icon: PlusCircle },
  { href: '/goals',      label: 'Goals',       icon: Target },
]

export function SidebarContent() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500 shrink-0">
          <Wallet className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-semibold text-base tracking-tight">Flow Finance</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-slate-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  )
}

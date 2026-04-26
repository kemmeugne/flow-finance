'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Tags,
  PlusCircle,
  Target,
  Receipt,
  Settings,
  LogOut,
  Leaf,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/categories',   label: 'Categories',   icon: Tags },
  { href: '/income',       label: 'Add Income',   icon: PlusCircle },
  { href: '/goals',        label: 'Goals',        icon: Target },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
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
    <div className="flex flex-col h-full bg-sage-900 text-sage-300">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sage-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sage-600 shrink-0">
          <Leaf className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-white font-semibold text-sm tracking-tight block">Flow Finance</span>
          <span className="text-sage-500 text-xs">Personal budget</span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-sage-600 text-white shadow-sm'
                  : 'text-sage-400 hover:bg-sage-800 hover:text-sage-100'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: settings + sign out */}
      <div className="px-3 py-4 border-t border-sage-800 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
            pathname === '/settings'
              ? 'bg-sage-600 text-white shadow-sm'
              : 'text-sage-400 hover:bg-sage-800 hover:text-sage-100'
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-sage-500 hover:bg-sage-800 hover:text-sage-200 transition-all duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  )
}

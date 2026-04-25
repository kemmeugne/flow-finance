export const dynamic = 'force-dynamic'

import { SidebarContent } from '@/components/layout/app-sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col">
        <SidebarContent />
      </aside>

      {/* Right side: mobile header + scrollable content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

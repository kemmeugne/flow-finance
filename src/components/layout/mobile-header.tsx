'use client'

import { useState } from 'react'
import { Menu, Leaf } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { SidebarContent } from './app-sidebar'

export function MobileHeader() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-sage-900 border-b border-sage-800">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-md text-sage-400 hover:text-white hover:bg-sage-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-sage-600">
            <Leaf className="w-3 h-3 text-white" />
          </div>
          <span className="text-white font-semibold text-sm">Flow Finance</span>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetContent side="left" className="p-0 w-64 border-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  )
}

import type { ReactNode } from "react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { MobileShell } from "@/components/mobile/mobile-shell"

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-full bg-background md:flex">
      <AppSidebar />
      <main className="min-w-0 flex-1 pb-[calc(88px+env(safe-area-inset-bottom,0px))] xl:pb-0">
        {children}
      </main>
      <MobileShell />
    </div>
  )
}

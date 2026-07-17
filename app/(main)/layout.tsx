import { DesktopDock } from "@/components/layout/desktop-dock"
import { Header } from "@/components/layout/header"

import { TwoFactorModal } from "@/components/auth/two-factor-modal"
import { NotesModal } from "@/components/dashboard/notes-modal"
import { ClientSessionSync } from "@/components/providers/client-session-sync"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-full bg-background relative">
      <ClientSessionSync />
      {/* Mobile Header (hidden on desktop) */}
      <div className="md:hidden">
        <Header />
      </div>

      {/* Desktop Dock (hidden on mobile) */}
      <DesktopDock />
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 md:pb-0 pb-[calc(112px+env(safe-area-inset-bottom,0px))]">
        {children}
      </main>

      {/* Security Overlays */}
      <TwoFactorModal />
      <NotesModal />
    </div>
  )
}

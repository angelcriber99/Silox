import { DesktopDock } from "@/components/layout/desktop-dock"
import { MobileShell } from "@/components/mobile/mobile-shell"

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
      {/* Desktop Dock (hidden on mobile) */}
      <DesktopDock />
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-[calc(112px+env(safe-area-inset-bottom,0px))] md:pb-24">
        {children}
      </main>

      {/* Mobile Bottom Navigation (hidden on desktop) */}
      <MobileShell />
      
      {/* Security Overlays */}
      <TwoFactorModal />
      <NotesModal />
    </div>
  )
}

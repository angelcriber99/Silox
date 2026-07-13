import { ProSidebar } from "@/components/layout/pro-sidebar"
import { MobileShell } from "@/components/mobile/mobile-shell"

import { TwoFactorModal } from "@/components/auth/two-factor-modal"
import { NotesModal } from "@/components/dashboard/notes-modal"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-full bg-background">
      {/* Desktop Sidebar (hidden on mobile) */}
      <ProSidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-[calc(112px+env(safe-area-inset-bottom,0px))] md:pb-0">
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

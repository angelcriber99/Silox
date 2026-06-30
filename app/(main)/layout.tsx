import { ProSidebar } from "@/components/layout/pro-sidebar"
import { MobileShell } from "@/components/mobile/mobile-shell"
import { FaceIdOverlay } from "@/components/mobile/face-id-overlay"
import { TwoFactorModal } from "@/components/auth/two-factor-modal"
import { NotesModal } from "@/components/dashboard/notes-modal"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      {/* Desktop Sidebar (hidden on mobile) */}
      <ProSidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation (hidden on desktop) */}
      <MobileShell />
      
      {/* Security Overlays */}
      <FaceIdOverlay />
      <TwoFactorModal />
      <NotesModal />
    </div>
  )
}

import { ProSidebar } from "@/components/layout/pro-sidebar"
import { ProBottomNav } from "@/components/mobile/pro-bottom-nav"
import { FaceIdOverlay } from "@/components/mobile/face-id-overlay"
import { TwoFactorModal } from "@/components/auth/two-factor-modal"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <ProSidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-24 md:pb-0">
        <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <ProBottomNav />

      {/* Security Overlays */}
      <FaceIdOverlay />
      <TwoFactorModal />
    </div>
  )
}

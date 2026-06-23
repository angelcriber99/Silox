import { Header } from "@/components/layout/header"
import { MobileShell } from "@/components/mobile/mobile-shell"
import { FaceIdOverlay } from "@/components/mobile/face-id-overlay"
import { TwoFactorModal } from "@/components/auth/two-factor-modal"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen pb-20 md:pb-0">
      {/* Desktop header (hidden on mobile since MobileDashboard has its own) */}
      <div className="hidden md:block">
        <Header />
      </div>
      <main className="flex-1">
        {children}
      </main>
      <MobileShell />
      
      {/* Security Overlays */}
      <FaceIdOverlay />
      <TwoFactorModal />
    </div>
  )
}

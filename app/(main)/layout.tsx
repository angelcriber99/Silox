import { DesktopDock } from "@/components/layout/desktop-dock"
import { MobileShell } from "@/components/mobile/mobile-shell"

import { TwoFactorModal } from "@/components/auth/two-factor-modal"
import { NotesModal } from "@/components/dashboard/notes-modal"
import { ClientSessionSync } from "@/components/providers/client-session-sync"
import { AppDataPreloader } from "@/components/providers/app-data-preloader"
import { PortfolioRealtimeSync } from "@/components/providers/portfolio-realtime-sync"
import { SilentDividendSync } from "@/components/providers/silent-dividend-sync"
import { PortfolioProvider } from "@/lib/context/portfolio-context"
import { GlobalSwipeBack } from "@/components/layout/global-swipe-back"
import { GlobalSearch } from "@/components/ui/global-search"
import { GlobalBackButton } from "@/components/layout/global-back-button"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PortfolioProvider>
      <div className="flex flex-col min-h-full bg-background relative">
        <ClientSessionSync />
        <AppDataPreloader />
        <PortfolioRealtimeSync />
        <SilentDividendSync />
        <GlobalSwipeBack />
        <GlobalBackButton />
        <GlobalSearch />
        <MobileShell />

        {/* Desktop Dock (hidden on mobile) */}
        <DesktopDock />
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 md:pb-0 pb-[calc(76px+env(safe-area-inset-bottom,0px))]">
          {children}
        </main>

        {/* Security Overlays */}
        <TwoFactorModal />
        <NotesModal />
      </div>
    </PortfolioProvider>
  )
}


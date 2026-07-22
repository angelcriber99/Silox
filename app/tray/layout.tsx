import { PortfolioProvider } from "@/lib/context/portfolio-context"
import { AppDataPreloader } from "@/components/providers/app-data-preloader"
import { PortfolioRealtimeSync } from "@/components/providers/portfolio-realtime-sync"

export default function TrayLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortfolioProvider>
      <div className="flex flex-col min-h-screen bg-transparent w-full">
        <AppDataPreloader />
        <PortfolioRealtimeSync />
        {children}
      </div>
    </PortfolioProvider>
  )
}

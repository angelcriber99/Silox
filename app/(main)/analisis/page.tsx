"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TrendingUp, PieChart, Target } from "lucide-react"

// We will create these components next
import { HistoricalChart } from "@/components/analysis/historical-chart"
import { AdvancedDiversification } from "@/components/analysis/advanced-diversification"
import { FireTracker } from "@/components/analysis/fire-tracker"

export default function AnalysisPage() {
  const [activeTab, setActiveTab] = useState<"evolucion" | "diversificacion" | "fire">("evolucion")

  const tabs = [
    { id: "evolucion", label: "Evolución", icon: TrendingUp },
    { id: "diversificacion", label: "Diversificación", icon: PieChart },
    { id: "fire", label: "Libertad Financiera", icon: Target },
  ] as const

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="px-4 pt-12 pb-4 md:px-8 md:pt-10 sticky top-0 bg-background/80 backdrop-blur-xl z-30 border-b border-border/40">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">Análisis</h1>
        
        {/* iOS Style Segmented Control */}
        <div className="flex p-1 space-x-1 bg-muted/50 rounded-xl overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  relative flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg flex-1 transition-colors whitespace-nowrap min-w-[120px]
                  ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80 hover:bg-muted/50"}
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabAnalisis"
                    className="absolute inset-0 bg-background shadow-sm rounded-lg border border-border/50"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <tab.icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 p-4 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full max-w-6xl mx-auto"
          >
            {activeTab === "evolucion" && <HistoricalChart />}
            {activeTab === "diversificacion" && <AdvancedDiversification />}
            {activeTab === "fire" && <FireTracker />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

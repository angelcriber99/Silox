"use client"

import { lazy, Suspense, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { PieChart, Target } from "lucide-react"

const ComprehensiveAnalysis = lazy(() =>
  import("@/components/analysis/comprehensive-analysis").then((mod) => ({
    default: mod.ComprehensiveAnalysis,
  }))
)
const Projections = lazy(() =>
  import("@/components/analysis/projections").then((mod) => ({
    default: mod.Projections,
  }))
)

export default function AnalysisPage() {
  const [activeTab, setActiveTab] = useState<"exhaustivo" | "proyecciones">("exhaustivo")

  const tabs = [
    { id: "exhaustivo", label: "Análisis Exhaustivo", icon: PieChart },
    { id: "proyecciones", label: "Proyecciones", icon: Target },
  ] as const

  return (
    <div className="mobile-screen flex flex-col min-h-screen pb-24 md:bg-background md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+14px)] backdrop-blur-xl md:px-8 md:pt-10">
        <div className="mobile-panel mb-3 p-4 md:bg-transparent md:border-0 md:p-0 md:shadow-none">
          <p className="mobile-caption mb-1">Inteligencia de cartera</p>
          <h1 className="text-3xl font-black tracking-normal text-foreground">Análisis</h1>
        </div>
        
        {/* iOS Style Segmented Control */}
        <div className="mobile-panel-muted grid grid-cols-2 gap-1 p-1 overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  relative flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-black uppercase tracking-[0.04em] rounded-md flex-1 transition-colors whitespace-nowrap min-w-[120px]
                  ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80 hover:bg-muted/50"}
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabAnalisis"
                    className="absolute inset-0 bg-background shadow-sm rounded-md border border-border/50"
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
      <main className="flex-1 p-3 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full max-w-6xl mx-auto"
          >
            <Suspense fallback={null}>
              {activeTab === "exhaustivo" && <ComprehensiveAnalysis />}
              {activeTab === "proyecciones" && <Projections />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

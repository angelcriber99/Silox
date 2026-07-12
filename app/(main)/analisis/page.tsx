"use client"

import { lazy, Suspense, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Bell, Layers3, PieChart, Search, ShieldCheck, Target } from "lucide-react"

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
    { id: "exhaustivo", label: "Resumen", icon: PieChart },
    { id: "proyecciones", label: "Proyecciones", icon: Target },
  ] as const

  return (
    <div className="mobile-screen flex flex-col min-h-screen pb-24 md:bg-background md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/90 px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+14px)] backdrop-blur-xl md:px-8 md:pt-10">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mobile-caption mb-1">Inteligencia de cartera</p>
            <h1 className="text-[32px] font-black leading-tight tracking-normal text-foreground">Análisis</h1>
            <p className="mt-1 max-w-[250px] text-xs font-semibold text-muted-foreground">
              Riesgo, diversificación y escenarios de tu portfolio.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/movimientos" className="mobile-focus-ring mobile-panel-muted flex h-10 w-10 items-center justify-center" aria-label="Buscar movimientos">
              <Search className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/settings" className="mobile-focus-ring mobile-panel-muted flex h-10 w-10 items-center justify-center" aria-label="Ajustes de alertas">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="mobile-panel-muted p-3">
            <ShieldCheck className="mb-2 h-4 w-4 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">Riesgo</p>
          </div>
          <div className="mobile-panel-muted p-3">
            <Layers3 className="mb-2 h-4 w-4 text-emerald-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">Diversificación</p>
          </div>
          <div className="mobile-panel-muted p-3">
            <Target className="mb-2 h-4 w-4 text-amber-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">Objetivos</p>
          </div>
        </div>
        
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

"use client"

import { lazy, Suspense, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { PieChart, Target, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

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
  const router = useRouter()

  const tabs = [
    { id: "exhaustivo", label: "Análisis Exhaustivo", icon: PieChart },
    { id: "proyecciones", label: "Proyecciones", icon: Target },
  ] as const

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="hidden md:flex px-4 pt-12 pb-4 md:px-8 md:pt-10 sticky top-0 bg-background/80 backdrop-blur-xl z-30 border-b border-border/40">
        <div className="flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <button 
              onClick={() => router.back()}
              className="p-1.5 md:p-2 -ml-2 md:ml-0 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Volver"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Análisis</h1>
          </div>
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
        </div>
      </header>

      {/* Mobile iOS Header */}
      <div className="md:hidden">
        <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/40">
          <div className="px-5 pb-3 pt-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">Análisis</h1>
            {/* iOS Native-looking Segmented Control */}
            <div className="flex p-1 bg-muted/60 rounded-xl">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`
                      relative flex-1 py-2 text-sm font-semibold rounded-lg transition-colors
                      ${isActive ? "text-foreground" : "text-muted-foreground"}
                    `}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabAnalisisMobile"
                        className="absolute inset-0 bg-background shadow-sm rounded-lg border border-border/20"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

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

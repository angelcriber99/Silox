"use client"

import { lazy, Suspense, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChartNoAxesCombined, PieChart, Target } from "lucide-react"

import { PageHeading } from "@/components/layout/page-heading"
import { IOSHeader } from "@/components/ui/ios-header"
import { cn } from "@/lib/utils"

const ComprehensiveAnalysis = lazy(() => import("@/components/analysis/comprehensive-analysis").then((module) => ({ default: module.ComprehensiveAnalysis })))
const Projections = lazy(() => import("@/components/analysis/projections").then((module) => ({ default: module.Projections })))

const tabs = [
  { id: "exhaustivo", label: "Cartera", longLabel: "Análisis de cartera", icon: PieChart },
  { id: "proyecciones", label: "Proyecciones", longLabel: "Proyecciones", icon: Target },
] as const

export default function AnalysisPage() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("exhaustivo")

  const tabSelector = (mobile = false) => (
    <div className={cn("grid grid-cols-2 rounded-xl border border-border/60 bg-muted/45 p-1", mobile ? "h-11" : "h-10 min-w-[340px]")}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id
        return (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={cn("relative min-w-0 rounded-lg px-3 text-xs font-bold text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", active && "text-foreground")}>
            {active && <motion.span layoutId={mobile ? "analysis-mobile-tab" : "analysis-desktop-tab"} className="absolute inset-0 rounded-lg border border-border/60 bg-background shadow-sm" transition={{ type: "spring", stiffness: 430, damping: 34 }} />}
            <span className="relative inline-flex items-center gap-1.5"><tab.icon className="size-3.5" /><span className="truncate">{mobile ? tab.label : tab.longLabel}</span></span>
          </button>
        )
      })}
    </div>
  )

  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="md:hidden"><IOSHeader title="Análisis" subtitle="Riesgo, diversificación y proyecciones">{tabSelector(true)}</IOSHeader></div>

      <div className="mx-auto w-full max-w-[1440px] px-3 py-4 md:px-6 md:py-8 lg:px-8">
        <PageHeading className="hidden md:flex" eyebrow="Inteligencia" title="Análisis de cartera" description="Entiende la concentración, la diversificación y el recorrido potencial de tus inversiones." icon={ChartNoAxesCombined} actions={tabSelector()} />

        <div className="mt-0 md:mt-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              <Suspense fallback={<div className="grid animate-pulse gap-4 md:grid-cols-3"><div className="h-40 rounded-2xl bg-muted/50 md:col-span-2" /><div className="h-40 rounded-2xl bg-muted/50" /><div className="h-72 rounded-2xl bg-muted/50 md:col-span-3" /></div>}>
                {activeTab === "exhaustivo" ? <ComprehensiveAnalysis /> : <Projections />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  )
}

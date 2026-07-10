"use client"

import { Projections } from "@/components/analysis/projections"

export default function AnalysisPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="px-4 pt-12 pb-4 md:px-8 md:pt-10 sticky top-0 bg-background/80 backdrop-blur-xl z-30 border-b border-border/40">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Proyecciones</h1>
      </header>

      {/* Content Area */}
      <main className="flex-1 p-4 md:p-8">
        <div className="w-full h-full max-w-6xl mx-auto">
          <Projections />
        </div>
      </main>
    </div>
  )
}

"use client"

import { AlertTriangle, CheckCircle2 } from "lucide-react"
import type { ReconciliationIssue } from "@/lib/utils/reconciliation"

interface ReconciliationAlertsProps {
  issues: ReconciliationIssue[]
}

export function ReconciliationAlerts({ issues }: ReconciliationAlertsProps) {
  if (issues.length === 0) {
    return null
  }

  return (
    <div className="mx-6 mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-500">
        <AlertTriangle className="h-4 w-4" />
        Revisión de consistencia
      </div>
      <div className="space-y-2">
        {issues.slice(0, 3).map((issue) => (
          <div key={issue.id} className="rounded-lg bg-background/60 px-3 py-2">
            <p className={issue.severity === "critical" ? "text-sm font-semibold text-rose-500" : "text-sm font-semibold text-foreground"}>
              {issue.title}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{issue.description}</p>
          </div>
        ))}
        {issues.length > 3 && (
          <p className="text-xs text-muted-foreground">Hay {issues.length - 3} avisos adicionales pendientes de revisar.</p>
        )}
      </div>
    </div>
  )
}

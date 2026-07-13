"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react"
import { fetchSystemHealth, type SystemHealthStatus } from "@/lib/api/system-health"
import { formatRelative } from "@/lib/utils/formatters"

function statusClass(status: SystemHealthStatus): string {
  if (status === "ok") return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
  if (status === "warning") return "text-amber-500 bg-amber-500/10 border-amber-500/20"
  return "text-rose-500 bg-rose-500/10 border-rose-500/20"
}

function StatusIcon({ status }: { status: SystemHealthStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4" />
  if (status === "warning") return <AlertTriangle className="h-4 w-4" />
  return <XCircle className="h-4 w-4" />
}

export function SystemHealthPanel() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["system-health"],
    queryFn: fetchSystemHealth,
    staleTime: 60_000,
  })

  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-foreground">Estado operativo</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Configuración mínima para crons, IA, auditoría e integraciones internas.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Revisar
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-500">
          No se pudo cargar el estado operativo.
        </div>
      ) : data ? (
        <>
          <div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${statusClass(data.status)}`}>
            <StatusIcon status={data.status} />
            {data.status === "ok" ? "Todo listo" : data.status === "warning" ? "Revisión recomendada" : "Acción requerida"}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.checks.map((check) => (
              <div key={check.id} className="rounded-xl border border-border/40 bg-background/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{check.label}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(check.status)}`}>
                    <StatusIcon status={check.status} />
                    {check.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Última revisión: {formatRelative(data.checkedAt)}
          </p>
        </>
      ) : null}
    </div>
  )
}

"use client"

import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, Clock3, FileSpreadsheet, XCircle } from "lucide-react"
import { fetchImportAudits } from "@/lib/api/imports"
import { formatRelative } from "@/lib/utils/formatters"
import type { ImportAudit } from "@/lib/types"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusMeta(status: ImportAudit["status"]) {
  if (status === "completed") {
    return { label: "Completada", icon: CheckCircle2, className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" }
  }
  if (status === "failed") {
    return { label: "Fallida", icon: XCircle, className: "text-rose-500 bg-rose-500/10 border-rose-500/20" }
  }
  return { label: "Procesando", icon: Clock3, className: "text-amber-500 bg-amber-500/10 border-amber-500/20" }
}

export function ImportHistory() {
  const { data: imports = [], isLoading, error } = useQuery({
    queryKey: ["imports", "recent"],
    queryFn: () => fetchImportAudits(8),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/30 p-4">
        <div className="h-4 w-40 rounded bg-muted animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-500">
        No se pudo cargar el historial de importaciones.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground">Historial de importaciones</h3>
          <p className="text-xs text-muted-foreground mt-1">Últimos archivos procesados con conteos auditables.</p>
        </div>
        <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
      </div>

      {imports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
          Aún no hay importaciones registradas.
        </p>
      ) : (
        <div className="space-y-2">
          {imports.map((item) => {
            const meta = statusMeta(item.status)
            const StatusIcon = meta.icon
            return (
              <div key={item.id} className="rounded-xl border border-border/40 bg-background/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{item.filename}</p>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.source}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelative(item.created_at)} · {formatFileSize(item.file_size)}
                    </p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-bold ${meta.className}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {meta.label}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                    <p className="font-bold text-foreground">{item.imported_count}</p>
                    <p className="text-[10px] text-muted-foreground">Nuevas</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                    <p className="font-bold text-foreground">{item.updated_count}</p>
                    <p className="text-[10px] text-muted-foreground">Actualizadas</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                    <p className="font-bold text-foreground">{item.ignored_count}</p>
                    <p className="text-[10px] text-muted-foreground">Duplicadas</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                    <p className="font-bold text-foreground">{item.removed_internal_movements}</p>
                    <p className="text-[10px] text-muted-foreground">Limpiadas</p>
                  </div>
                </div>

                {item.error && (
                  <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
                    {item.error}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

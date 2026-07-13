"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { buildTaxReportFilename } from "@/lib/utils/tax-report"

interface TaxJsonExportProps {
  year: number
}

export function TaxJsonExport({ year }: TaxJsonExportProps) {
  const [pending, setPending] = useState(false)

  const handleExport = async () => {
    setPending(true)

    try {
      const response = await fetch(`/api/reports/tax?year=${year}`)
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "No se pudo generar el informe fiscal")
      }

      const generatedAt = payload.report?.generatedAt ? new Date(payload.report.generatedAt) : new Date()
      const blob = new Blob([JSON.stringify(payload.report, null, 2)], { type: "application/json;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = buildTaxReportFilename(year, generatedAt)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(`Informe fiscal ${year} descargado`)
    } catch (error: any) {
      toast.error(error.message || "No se pudo descargar el informe fiscal")
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={pending}
      className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card hover:bg-muted text-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed no-print"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {pending ? "Generando..." : "JSON Fiscal"}
    </button>
  )
}

"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { fetchAllTransactionsForTax } from "@/lib/api/transactions"
import { buildTransactionsCsvFilename, transactionsToCsv } from "@/lib/utils/transactions-csv"

interface ExportTransactionsCsvButtonProps {
  className?: string
}

export function ExportTransactionsCsvButton({ className }: ExportTransactionsCsvButtonProps) {
  const [pending, setPending] = useState(false)

  const handleExport = async () => {
    setPending(true)
    try {
      const transactions = await fetchAllTransactionsForTax()
      const csv = transactionsToCsv(transactions)
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = buildTransactionsCsvFilename()
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(`Exportadas ${transactions.length} transacciones`)
    } catch (error: any) {
      toast.error(error.message || "No se pudo exportar el historial")
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={pending}
      className={className}
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {pending ? "Exportando..." : "CSV Export"}
    </button>
  )
}

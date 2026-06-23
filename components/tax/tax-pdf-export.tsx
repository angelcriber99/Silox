"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"

interface TaxPdfExportProps {
  targetId: string
  filename?: string
}

export function TaxPdfExport({ targetId, filename = "Silox_Informe_Fiscal.pdf" }: TaxPdfExportProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    try {
      setIsExporting(true)
      
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")

      const element = document.getElementById(targetId)
      if (!element) throw new Error("Target element not found")

      // Temporarily modify the element for better PDF rendering if needed
      // For instance, we can add a specific class that forces white background
      const originalBg = element.style.backgroundColor
      element.style.backgroundColor = "#09090b" // Match dark theme bg

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#09090b",
        windowWidth: 1200 // Force desktop width
      })

      element.style.backgroundColor = originalBg

      const imgData = canvas.toDataURL("image/png")
      
      // Calculate PDF dimensions (A4 size: 210 x 297 mm)
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      
      let heightLeft = pdfHeight
      let position = 0

      // Add first page
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight)
      heightLeft -= pdf.internal.pageSize.getHeight()

      // Add subsequent pages if content is taller than one A4 page
      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight
        pdf.addPage()
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight)
        heightLeft -= pdf.internal.pageSize.getHeight()
      }

      pdf.save(filename)
    } catch (error) {
      console.error("Error exporting PDF:", error)
      alert("Hubo un error al generar el PDF.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generando PDF...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Descargar Informe PDF
        </>
      )}
    </button>
  )
}

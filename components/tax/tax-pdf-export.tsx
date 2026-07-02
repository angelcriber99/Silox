"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"

interface TaxPdfExportProps {
  targetId: string
  filename?: string
}

export function TaxPdfExport({ targetId, filename = "Silox_Informe_Fiscal.pdf" }: TaxPdfExportProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = () => {
    setIsExporting(true)
    
    try {
      // Add a style tag temporarily to ensure dark mode prints well or force specific print styles
      const style = document.createElement('style');
      style.innerHTML = `
        @media print {
          @page { margin: 1cm; size: A4 portrait; }
          body { 
            background-color: white !important; 
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide everything except the target element */
          body * {
            visibility: hidden;
          }
          #${targetId}, #${targetId} * {
            visibility: visible;
          }
          #${targetId} {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          /* Hide the export buttons and interactive elements during print */
          button, .no-print {
            display: none !important;
          }
          /* Ensure cards have borders instead of dark backgrounds in print */
          .bg-card {
            background-color: white !important;
            border: 1px solid #ccc !important;
            color: black !important;
          }
          .text-muted-foreground {
            color: #666 !important;
          }
          /* Fix positive/negative colors for print */
          .text-emerald-500 { color: #059669 !important; }
          .text-rose-500 { color: #e11d48 !important; }
        }
      `;
      document.head.appendChild(style);

      // Trigger the native print dialog
      window.print();

      // Clean up the style tag after print dialog closes
      setTimeout(() => {
        document.head.removeChild(style);
      }, 1000);
      
    } catch (error) {
      console.error("Error with print dialog:", error)
      alert("Hubo un error al preparar la impresión.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 no-print"
    >
      <Download className="h-4 w-4" />
      Descargar Informe PDF
    </button>
  )
}

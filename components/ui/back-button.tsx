"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      className={`p-1.5 md:p-2 -ml-2 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ${className}`}
      title="Volver"
    >
      <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
    </button>
  )
}

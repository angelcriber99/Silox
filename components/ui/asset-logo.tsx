"use client"

import { useState } from "react"
import { motion } from "framer-motion"

interface AssetLogoProps {
  ticker: string
  name?: string | null
  type?: string
  className?: string
  fallbackClassName?: string
  size?: number
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; pill: string }> = {
  "ETF":             { color: "#0A84FF", bg: "rgba(10,132,255,0.13)",  pill: "rgba(10,132,255,0.20)"  },
  "Fondo Indexado":  { color: "#BF5AF2", bg: "rgba(191,90,242,0.13)", pill: "rgba(191,90,242,0.20)"  },
  "Fondo Monetario": { color: "#32ADE6", bg: "rgba(50,173,230,0.13)", pill: "rgba(50,173,230,0.20)"  },
  "Acción":          { color: "#FFD60A", bg: "rgba(255,214,10,0.13)", pill: "rgba(255,214,10,0.20)"  },
  "Crypto":          { color: "#FF9F0A", bg: "rgba(255,159,10,0.13)", pill: "rgba(255,159,10,0.20)"  },
  "Liquidez":        { color: "#98989D", bg: "rgba(152,152,157,0.13)",pill: "rgba(152,152,157,0.20)" },
}

export function AssetLogo({
  ticker,
  name,
  type = "Acción",
  className = "",
  fallbackClassName = "",
  size = 48,
}: AssetLogoProps) {
  const [error, setError] = useState(false)

  const displayTicker =
    type === "Fondo Indexado" || type === "Fondo Monetario"
      ? name?.split(" ")[0]?.toUpperCase() || "FONDO"
      : ticker.split(".")[0]

  const logoTicker = displayTicker.includes("-") ? displayTicker.split("-")[0] : displayTicker
  const cfg = TYPE_CONFIG[type] ?? { color: "#98989D", bg: "rgba(152,152,157,0.13)", pill: "rgba(152,152,157,0.20)" }

  const Fallback = () => (
    <div
      className={`flex items-center justify-center font-black ${fallbackClassName}`}
      style={{
        background: cfg.bg,
        color: cfg.color,
        border: `1.5px solid ${cfg.pill}`,
        letterSpacing: "-0.02em",
        width: "100%",
        height: "100%",
        fontSize: size * 0.35,
        borderRadius: size * 0.25,
      }}
    >
      {displayTicker.slice(0, 2)}
    </div>
  )

  if (error || type === "Liquidez") {
    return (
      <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
         <Fallback />
      </div>
    )
  }

  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 ${className}`} style={{ width: size, height: size, borderRadius: size * 0.25 }}>
      {/* Background layer */}
      <div 
        className="absolute inset-0"
        style={{
          background: cfg.bg,
          border: `1.5px solid ${cfg.pill}`,
          borderRadius: size * 0.25,
        }}
      />
      {/* Image layer */}
      <img
        src={`/api/logo?ticker=${logoTicker}`}
        alt={logoTicker}
        className="w-full h-full object-contain p-[15%] drop-shadow-sm relative z-10"
        onError={() => setError(true)}
      />
    </div>
  )
}

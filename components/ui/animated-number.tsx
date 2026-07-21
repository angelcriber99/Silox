"use client"

import { useEffect, useRef } from "react"
import { useInView, useMotionValue, useSpring } from "framer-motion"
import { formatCurrency, formatPercent, formatPnl } from "@/lib/utils/formatters"

interface AnimatedNumberProps {
  value: number
  format?: "currency" | "percent" | "pnl" | "none"
  className?: string
  hide?: boolean
  prefix?: string
  currency?: string
}

export function AnimatedNumber({
  value,
  format = "none",
  className,
  hide = false,
  prefix = "",
  currency = "EUR",
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  
  // Spring settings for a snappy but organic rolling effect
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 100,
  })
  
  const isInView = useInView(ref, { once: true, margin: "-20px" })

  useEffect(() => {
    if (isInView && !hide) {
      motionValue.set(value)
    }
  }, [motionValue, value, isInView, hide])

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (ref.current) {
        if (hide) {
          if (format === "percent") {
            ref.current.textContent = prefix + "**.*%"
          } else {
            ref.current.textContent = prefix + "****"
          }
          return
        }

        let formattedStr = latest.toFixed(2)
        if (format === "currency") {
          formattedStr = formatCurrency(latest, currency)
        } else if (format === "percent") {
          formattedStr = formatPercent(latest)
        } else if (format === "pnl") {
          formattedStr = formatPnl(latest, currency)
        }
        ref.current.textContent = prefix + formattedStr
      }
    })
  }, [springValue, format, hide, prefix, currency])

  // Initial render (fallback)
  let initial = "0"
  if (hide) initial = format === "percent" ? "**.*%" : "****"
  
  return <span ref={ref} className={className}>{prefix}{initial}</span>
}

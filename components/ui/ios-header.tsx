"use client"

import { ReactNode } from "react"
import { motion } from "framer-motion"

interface IOSHeaderProps {
  title: string
  subtitle?: string
  rightAction?: ReactNode
  children?: ReactNode
  /** Large title style like Apple's HIG — default true */
  largeTile?: boolean
}

export function IOSHeader({
  title,
  subtitle,
  rightAction,
  children,
  largeTile = true,
}: IOSHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(32px) saturate(180%)",
        WebkitBackdropFilter: "blur(32px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.10)",
      }}
    >
      <div
        className="flex flex-col px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: children ? "12px" : "14px",
        }}
      >
        {/* Title row */}
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col"
          >
            <h1
              style={{
                fontSize: largeTile ? 34 : 22,
                fontWeight: 700,
                letterSpacing: -0.5,
                color: "#FFFFFF",
                lineHeight: 1.1,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.45)",
                  marginTop: 2,
                  fontWeight: 400,
                }}
              >
                {subtitle}
              </p>
            )}
          </motion.div>

          {rightAction && (
            <div className="flex items-center gap-2 ml-3">
              {rightAction}
            </div>
          )}
        </div>

        {/* Sub-content (search bar, chips, etc.) */}
        {children && (
          <div style={{ marginTop: 10 }}>
            {children}
          </div>
        )}
      </div>
    </header>
  )
}

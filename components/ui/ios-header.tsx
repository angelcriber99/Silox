"use client"

import type { ReactNode } from "react"

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
      className="sticky top-0 z-30 border-b border-border/70 bg-background/92 shadow-[0_12px_40px_-34px_rgba(0,0,0,.8)] backdrop-blur-2xl"
    >
      <div
        className="flex flex-col px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
          paddingBottom: children ? "10px" : "12px",
        }}
      >
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-col">
            <h1
              className="truncate text-foreground"
              style={{
                fontSize: largeTile ? 28 : 21,
                fontWeight: 800,
                letterSpacing: -0.65,
                lineHeight: 1.1,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>

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

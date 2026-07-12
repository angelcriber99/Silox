"use client"

import { ReactNode } from "react"

interface IOSHeaderProps {
  title: string
  rightAction?: ReactNode
  children?: ReactNode
}

export function IOSHeader({ title, rightAction, children }: IOSHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40 pb-3">
      <div className="flex flex-col px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-foreground transition-all">
            {title}
          </h1>
          {rightAction && (
            <div className="flex items-center gap-2">
              {rightAction}
            </div>
          )}
        </div>
        {children && (
          <div className="mt-4">
            {children}
          </div>
        )}
      </div>
    </header>
  )
}

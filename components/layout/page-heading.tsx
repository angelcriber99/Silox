import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface PageHeadingProps {
  eyebrow?: string
  title: string
  description: string
  icon: LucideIcon
  actions?: ReactNode
  className?: string
}

export function PageHeading({ eyebrow, title, description, icon: Icon, actions, className }: PageHeadingProps) {
  return (
    <header className={cn("flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>}
          <h1 className="text-2xl font-black tracking-[-0.04em] text-foreground sm:text-3xl">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[58px] sm:pl-0">{actions}</div>}
    </header>
  )
}


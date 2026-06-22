"use client"

import { useState } from "react"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav"
import { MobileBottomSheet } from "@/components/mobile/mobile-bottom-sheet"

export function MobileShell() {
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false)
  const { positions } = usePortfolio()

  return (
    <>
      <MobileBottomNav onAddPress={() => setBottomSheetOpen(true)} />
      <MobileBottomSheet
        open={bottomSheetOpen}
        onClose={() => setBottomSheetOpen(false)}
        positions={positions}
      />
    </>
  )
}

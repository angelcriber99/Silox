"use client"

import { useState } from "react"

import { usePortfolioContext } from "@/lib/context/portfolio-context"
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav"
import { MobileBottomSheet } from "@/components/mobile/mobile-bottom-sheet"
import { MobileMoreMenu } from "@/components/mobile/mobile-more-menu"
import { useQuickAdd } from "@/lib/stores/use-quick-add"

export function MobileShell() {
  const [moreOpen, setMoreOpen] = useState(false)
  const { isOpen, preselectedAsset, openEmpty, close } = useQuickAdd()
  const { positions } = usePortfolioContext()

  return (
    <>
      <MobileBottomNav onAddPress={openEmpty} onMorePress={() => setMoreOpen(true)} />
      <MobileBottomSheet
        open={isOpen}
        onClose={close}
        positions={positions}
        preselectedAsset={preselectedAsset}
      />
      <MobileMoreMenu open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}

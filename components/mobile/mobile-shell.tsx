"use client"

import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav"
import { MobileBottomSheet } from "@/components/mobile/mobile-bottom-sheet"
import { useQuickAdd } from "@/lib/stores/use-quick-add"

export function MobileShell() {
  const { isOpen, preselectedAsset, openEmpty, close } = useQuickAdd()
  const { positions } = usePortfolio({ enabled: isOpen })

  return (
    <>
      <MobileBottomNav onAddPress={openEmpty} />
      <MobileBottomSheet
        open={isOpen}
        onClose={close}
        positions={positions}
        preselectedAsset={preselectedAsset}
      />
    </>
  )
}

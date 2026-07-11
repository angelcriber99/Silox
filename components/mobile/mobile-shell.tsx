"use client"

import { lazy, Suspense, useEffect, useState } from "react"
import { usePortfolio } from "@/lib/hooks/use-portfolio"
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav"
import { useQuickAdd } from "@/lib/stores/use-quick-add"

const MobileBottomSheet = lazy(() =>
  import("@/components/mobile/mobile-bottom-sheet").then((mod) => ({
    default: mod.MobileBottomSheet,
  }))
)

export function MobileShell() {
  const { isOpen, preselectedAsset, openEmpty, close } = useQuickAdd()
  const { positions } = usePortfolio({ enabled: isOpen })
  const [sheetLoaded, setSheetLoaded] = useState(false)

  useEffect(() => {
    if (isOpen) setSheetLoaded(true)
  }, [isOpen])

  return (
    <>
      <MobileBottomNav onAddPress={openEmpty} />
      {sheetLoaded && (
        <Suspense fallback={null}>
          <MobileBottomSheet
            open={isOpen}
            onClose={close}
            positions={positions}
            preselectedAsset={preselectedAsset}
          />
        </Suspense>
      )}
    </>
  )
}

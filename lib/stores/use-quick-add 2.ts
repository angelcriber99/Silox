import { create } from "zustand"
import type { EnrichedPosition } from "@/lib/types"

interface QuickAddStore {
  isOpen: boolean
  preselectedAsset: EnrichedPosition | null
  openWithAsset: (asset: EnrichedPosition) => void
  openEmpty: () => void
  close: () => void
}

export const useQuickAdd = create<QuickAddStore>((set) => ({
  isOpen: false,
  preselectedAsset: null,
  openWithAsset: (asset) => set({ isOpen: true, preselectedAsset: asset }),
  openEmpty: () => set({ isOpen: true, preselectedAsset: null }),
  close: () => set({ isOpen: false, preselectedAsset: null }),
}))

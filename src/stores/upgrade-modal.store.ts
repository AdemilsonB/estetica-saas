import { create } from 'zustand'

export type UpgradeContext = {
  capabilityKey?: string
  limitType?: string
  requiredPlan?: string | null
  requiredPlanLabel?: string | null
}

type UpgradeModalState = {
  open: boolean
  context: UpgradeContext | null
  openUpgrade: (context: UpgradeContext) => void
  close: () => void
}

export const useUpgradeModal = create<UpgradeModalState>((set) => ({
  open: false,
  context: null,
  openUpgrade: (context) => set({ open: true, context }),
  close: () => set({ open: false, context: null }),
}))

'use client'

import { UpgradeModal } from './upgrade-modal'

// Montado uma vez em Providers; o conteúdo vem do store useUpgradeModal.
export function GlobalUpgradeModal() {
  return <UpgradeModal />
}

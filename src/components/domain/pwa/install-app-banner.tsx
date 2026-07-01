'use client'

import { useEffect, useRef, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { usePwaInstall } from './use-pwa-install'
import { InstallInstructionsModal } from './install-instructions-modal'

const VISITS_KEY = 'agende:agenda-visits'
const DISMISSED_KEY = 'agende:install-banner-dismissed'
const MIN_VISITS = 2

export function InstallAppBanner() {
  const { isStandalone, platform, deferredPrompt } = usePwaInstall()
  const [visible, setVisible] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const incremented = useRef(false)

  useEffect(() => {
    if (isStandalone) return
    if (localStorage.getItem(DISMISSED_KEY)) return
    if (platform === 'other' && !deferredPrompt) return
    if (incremented.current) return
    incremented.current = true

    const visits = Number(localStorage.getItem(VISITS_KEY) ?? '0') + 1
    localStorage.setItem(VISITS_KEY, String(visits))
    if (visits >= MIN_VISITS) setVisible(true)
  }, [isStandalone, platform, deferredPrompt])

  if (!visible) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  return (
    <>
      <div className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-pink-50 p-4">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-violet-600" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-slate-800">
            Tenha o Agendê na tela inicial
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Abre rápido, sem o navegador.
          </p>
          <button
            className="mt-2 text-sm font-semibold text-violet-700 hover:text-violet-900"
            onClick={() => setModalOpen(true)}
          >
            Ver como instalar
          </button>
        </div>
        <button aria-label="Dispensar" onClick={dismiss} className="text-slate-400 hover:text-slate-600">
          <X className="size-4" />
        </button>
      </div>

      <InstallInstructionsModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}

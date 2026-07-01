'use client'

import { useEffect, useState, useCallback } from 'react'

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'android' | 'ios' | 'other'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'other'
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mm = window.matchMedia?.('(display-mode: standalone)').matches
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone
  return Boolean(mm || iosStandalone)
}

export function usePwaInstall() {
  const [isStandalone, setIsStandalone] = useState(false)
  const [platform, setPlatform] = useState<Platform>('other')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setIsStandalone(detectStandalone())
    setPlatform(detectPlatform())

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }, [deferredPrompt])

  return { isStandalone, platform, deferredPrompt, promptInstall }
}

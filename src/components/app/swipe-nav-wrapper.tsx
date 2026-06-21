'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'

const SWIPE_ROUTES = ['/agenda', '/servicos', '/clientes', '/equipe', '/configuracoes'] as const
const DRAG_THRESHOLD = 80
const VELOCITY_THRESHOLD = 500

const variants = {
  enter: (dir: number) => ({ x: dir < 0 ? '100%' : '-100%' }),
  center: { x: 0 },
  exit: (dir: number) => ({ x: dir < 0 ? '-100%' : '100%' }),
}

const transition = { type: 'spring', damping: 30, stiffness: 300 }

interface SwipeNavWrapperProps {
  children: React.ReactNode
}

export function SwipeNavWrapper({ children }: SwipeNavWrapperProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)
  const directionRef = useRef(0)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const cycleIndex = SWIPE_ROUTES.findIndex(r => pathname === r)
  const isInCycle = cycleIndex !== -1
  const isClientDetail = pathname.startsWith('/clientes/') && pathname !== '/clientes'

  useEffect(() => {
    if (!isInCycle) return
    if (cycleIndex > 0) router.prefetch(SWIPE_ROUTES[cycleIndex - 1])
    if (cycleIndex < SWIPE_ROUTES.length - 1) router.prefetch(SWIPE_ROUTES[cycleIndex + 1])
  }, [cycleIndex, isInCycle, router])

  function navigate(delta: number) {
    const next = SWIPE_ROUTES[cycleIndex + delta]
    if (!next) return
    directionRef.current = delta
    router.push(next)
  }

  if (!isMobile) return <>{children}</>

  if (!isInCycle && !isClientDetail) return <>{children}</>

  return (
    <AnimatePresence mode="wait" initial={false} custom={directionRef.current}>
      <motion.div
        key={pathname}
        custom={directionRef.current}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={transition}
        drag={isInCycle || isClientDetail ? 'x' : false}
        dragDirectionLock
        dragMomentum={false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={(_, { offset, velocity }) => {
          const goNext = offset.x < -DRAG_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD
          const goPrev = offset.x > DRAG_THRESHOLD || velocity.x > VELOCITY_THRESHOLD

          if (isInCycle) {
            if (goNext && cycleIndex < SWIPE_ROUTES.length - 1) navigate(1)
            if (goPrev && cycleIndex > 0) navigate(-1)
          }

          if (isClientDetail && goPrev) router.back()
        }}
        className="min-h-full w-full"
        style={{ touchAction: 'pan-y' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

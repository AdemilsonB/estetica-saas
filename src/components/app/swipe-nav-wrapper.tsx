'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, useMotionValue, animate } from 'framer-motion'

const SWIPE_ROUTES = ['/agenda', '/servicos', '/clientes', '/equipe', '/configuracoes'] as const
const DRAG_THRESHOLD = 80
const VELOCITY_THRESHOLD = 500

// Spring de saída/entrada rápido — igual ao feel nativo do iOS
const SPRING = { type: 'spring', damping: 28, stiffness: 380, restDelta: 0.5 } as const
// Spring de retorno suave quando o threshold não foi atingido
const SPRING_BACK = { type: 'spring', damping: 26, stiffness: 300 } as const

export function SwipeNavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)

  // MotionValue controla posição X da página (persiste entre navegações)
  const x = useMotionValue(0)

  // Direção do último swipe (1 = próxima, -1 = anterior)
  const dirRef = useRef(0)
  // Sinaliza que a mudança de pathname veio de um swipe (anima entrada)
  const isSwipeNavRef = useRef(false)
  // Referência para cancelar animação em curso ao novo drag
  const animRef = useRef<{ stop(): void } | null>(null)
  // Evita animação de entrada no primeiro render
  const mountRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Quando pathname muda: anima entrada se foi por swipe, ou snap direto ao centro
  useEffect(() => {
    if (!mountRef.current) {
      mountRef.current = true
      return
    }
    stopAnim()
    if (isSwipeNavRef.current) {
      isSwipeNavRef.current = false
      const W = window.innerWidth
      // Nova página entra pelo lado oposto à direção de saída
      x.set(dirRef.current > 0 ? W : -W)
      animRef.current = animate(x, 0, SPRING)
    } else {
      // Navegação via link/tab — sem animação de swipe
      x.set(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const cycleIndex = SWIPE_ROUTES.findIndex(r => pathname === r)
  const isInCycle = cycleIndex !== -1
  const isClientDetail = pathname.startsWith('/clientes/') && pathname !== '/clientes'

  // Pré-carrega rotas adjacentes para transição instantânea
  useEffect(() => {
    if (!isInCycle) return
    if (cycleIndex > 0) router.prefetch(SWIPE_ROUTES[cycleIndex - 1])
    if (cycleIndex < SWIPE_ROUTES.length - 1) router.prefetch(SWIPE_ROUTES[cycleIndex + 1])
  }, [cycleIndex, isInCycle, router])

  function stopAnim() {
    if (animRef.current) { animRef.current.stop(); animRef.current = null }
  }

  // Anima a página atual para fora e navega ao completar
  function navigateTo(delta: number, doNav: () => void) {
    dirRef.current = delta
    isSwipeNavRef.current = true
    stopAnim()
    const W = window.innerWidth
    const targetX = delta > 0 ? -W : W
    const anim = animate(x, targetX, SPRING)
    animRef.current = anim
    // .then() só dispara se a animação completar (stop() previne isso)
    anim.then(() => {
      if (isSwipeNavRef.current) doNav()
    })
  }

  if (!isMobile) return <>{children}</>
  if (!isInCycle && !isClientDetail) return <>{children}</>

  return (
    <motion.div
      style={{ x, touchAction: 'pan-y' }}
      drag={isInCycle || isClientDetail ? 'x' : false}
      dragDirectionLock
      dragMomentum={false}
      // Constraints amplos = sem resistência elástica, tracking 1:1 com o dedo
      dragConstraints={{ left: -9999, right: 9999 }}
      dragElastic={0}
      onDragStart={() => {
        // Se havia animação em curso (ex: usuário re-agarra durante transição), cancela
        stopAnim()
        isSwipeNavRef.current = false
      }}
      onDragEnd={(_, { offset, velocity }) => {
        const goNext = offset.x < -DRAG_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD
        const goPrev = offset.x > DRAG_THRESHOLD || velocity.x > VELOCITY_THRESHOLD

        if (isInCycle) {
          const next = SWIPE_ROUTES[cycleIndex + 1]
          const prev = SWIPE_ROUTES[cycleIndex - 1]
          if (goNext && next) { navigateTo(1, () => router.push(next)); return }
          if (goPrev && prev) { navigateTo(-1, () => router.push(prev)); return }
        }

        if (isClientDetail && goPrev) { navigateTo(-1, () => router.back()); return }

        // Threshold não atingido — retorna suavemente ao centro
        stopAnim()
        animRef.current = animate(x, 0, SPRING_BACK)
      }}
      className="min-h-full w-full"
    >
      {children}
    </motion.div>
  )
}

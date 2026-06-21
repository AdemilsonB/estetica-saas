'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, useMotionValue, animate } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'

const SWIPE_ROUTES = ['/dashboard', '/agenda', '/servicos', '/clientes', '/equipe', '/configuracoes'] as const
const DRAG_THRESHOLD = 80
const VELOCITY_THRESHOLD = 500

// Spring de entrada — snappy, feel nativo iOS
const SPRING = { type: 'spring', damping: 32, stiffness: 450, restDelta: 0.5 } as const
// Spring de retorno suave quando o threshold não foi atingido
const SPRING_BACK = { type: 'spring', damping: 26, stiffness: 300 } as const

// Pré-aquece o cache do TanStack Query para as rotas adjacentes
function prefetchRouteData(route: string, qc: ReturnType<typeof useQueryClient>) {
  switch (route) {
    case '/dashboard':
      qc.prefetchQuery({
        queryKey: ['dashboard-metrics'],
        queryFn: () => fetch('/api/dashboard/metrics').then(r => r.json()),
        staleTime: 30 * 1000,
      })
      break
    case '/servicos':
      qc.prefetchQuery({
        queryKey: ['services'],
        queryFn: () => fetch('/api/scheduling/services').then(r => r.json()),
        staleTime: 5 * 60 * 1000,
      })
      break
    case '/equipe':
      qc.prefetchQuery({
        queryKey: ['team-members'],
        queryFn: () => fetch('/api/iam/users').then(r => r.json()),
        staleTime: 5 * 60 * 1000,
      })
      break
    case '/clientes':
      // key match: useCustomers({ search: undefined, page: 1 }) → hash {"page":1}
      qc.prefetchQuery({
        queryKey: ['customers', { page: 1 }],
        queryFn: () => fetch('/api/crm/customers?page=1').then(r => r.json()),
        staleTime: 30 * 1000,
      })
      break
    case '/agenda': {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const end = new Date(); end.setHours(23, 59, 59, 999)
      const from = start.toISOString()
      const to = end.toISOString()
      // key match: useAppointments({ from, to }) sem professionalId → hash {"from":X,"to":Y}
      qc.prefetchQuery({
        queryKey: ['appointments', { from, to }],
        queryFn: () =>
          fetch(`/api/scheduling/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then(r => r.json()),
        staleTime: 30 * 1000,
      })
      // Agenda também usa team-members para o filtro de profissional
      qc.prefetchQuery({
        queryKey: ['team-members'],
        queryFn: () => fetch('/api/iam/users').then(r => r.json()),
        staleTime: 5 * 60 * 1000,
      })
      break
    }
  }
}

export function SwipeNavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
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

  // Pré-carrega JS (router.prefetch) e dados (queryClient) das rotas adjacentes
  useEffect(() => {
    if (!isInCycle) return
    const prev = SWIPE_ROUTES[cycleIndex - 1]
    const next = SWIPE_ROUTES[cycleIndex + 1]
    if (prev) { router.prefetch(prev); prefetchRouteData(prev, queryClient) }
    if (next) { router.prefetch(next); prefetchRouteData(next, queryClient) }
  }, [cycleIndex, isInCycle, router, queryClient])

  function stopAnim() {
    if (animRef.current) { animRef.current.stop(); animRef.current = null }
  }

  // Inicia navegação imediatamente em paralelo com a animação de saída.
  // Assim o Next.js já começa a carregar a rota enquanto a tela atual sai,
  // eliminando o delay que existia quando navegávamos apenas após a animação terminar.
  function navigateTo(delta: number, doNav: () => void) {
    dirRef.current = delta
    isSwipeNavRef.current = true
    stopAnim()
    const W = window.innerWidth
    const targetX = delta > 0 ? -W : W
    doNav()
    animRef.current = animate(x, targetX, SPRING)
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

'use client'

// src/components/domain/landing/landing-branding.tsx
// Seção "Sua marca, do seu jeito": demonstra a configurabilidade REAL do domínio
// Branding (cores, logo, link público). O seletor recolore o mockup de vitrine ao vivo.

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

type BrandColor = {
  name: string
  value: string
  soft: string
}

// Tons warm, coerentes com a identidade do produto.
const COLORS: BrandColor[] = [
  { name: 'Violeta', value: '#7C3AED', soft: '#F3EEFF' },
  { name: 'Rosa', value: '#DB2777', soft: '#FCE8F1' },
  { name: 'Âmbar', value: '#D97706', soft: '#FEF1E0' },
  { name: 'Esmeralda', value: '#059669', soft: '#E3F5EE' },
  { name: 'Azul', value: '#2563EB', soft: '#E6EEFE' },
]

const BULLETS = [
  { icon: '🎨', text: 'Cores e logo com a identidade do seu negócio' },
  { icon: '🔗', text: 'Link público (vitrine) para o Instagram e WhatsApp' },
  { icon: '🔓', text: 'Recursos ativáveis conforme o seu plano' },
]

export function LandingBranding() {
  const [active, setActive] = useState(0)
  const reduceMotion = useReducedMotion()
  const brand = COLORS[active]

  return (
    <section className="bg-white px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center sm:mb-12">
          <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl md:text-4xl">
            Sua marca, do seu jeito
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 sm:text-lg">
            Personalize cores, logo e seu link público. O Agendê veste a identidade do seu
            salão — não a nossa.
          </p>
        </div>

        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
          {/* Controles */}
          <div>
            <span className="text-sm font-semibold text-slate-700">Toque numa cor:</span>
            <div
              role="radiogroup"
              aria-label="Cor da marca"
              className="mt-3 flex flex-wrap gap-3"
            >
              {COLORS.map((c, i) => {
                const selected = i === active
                return (
                  <motion.button
                    key={c.name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={c.name}
                    onClick={() => setActive(i)}
                    whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                    className={`flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                      selected ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200'
                    }`}
                    style={{ backgroundColor: c.value }}
                  >
                    {selected && <span className="text-sm font-bold text-white">✓</span>}
                  </motion.button>
                )
              })}
            </div>

            <ul className="mt-6 space-y-3">
              {BULLETS.map((b) => (
                <li key={b.text} className="flex items-start gap-3 text-sm text-slate-600">
                  <span className="text-base">{b.icon}</span>
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mockup de vitrine que recolore ao vivo */}
          <motion.div
            key={reduceMotion ? undefined : brand.value}
            initial={reduceMotion ? false : { opacity: 0.6, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60"
          >
            {/* Header da vitrine — usa a cor da marca */}
            <div
              className="flex items-center gap-3 px-5 py-4 transition-colors duration-300"
              style={{ backgroundColor: brand.value }}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/25 text-lg font-extrabold text-white">
                a
              </div>
              <div>
                <div className="text-sm font-bold text-white">Studio Bella</div>
                <div className="text-[11px] text-white/80">★ 4,9 · Reserve seu horário</div>
              </div>
            </div>

            <div className="bg-white p-5">
              {/* Categorias */}
              <div className="mb-4 flex flex-wrap gap-2">
                {['Corte', 'Escova', 'Luzes'].map((cat, i) => {
                  const on = i === 0
                  return (
                    <span
                      key={cat}
                      className="rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-300"
                      style={
                        on
                          ? { backgroundColor: brand.soft, color: brand.value }
                          : { backgroundColor: '#F1F5F9', color: '#64748B' }
                      }
                    >
                      {cat}
                    </span>
                  )
                })}
              </div>

              {/* Serviço */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                <div
                  className="h-12 w-12 shrink-0 rounded-lg transition-colors duration-300"
                  style={{ backgroundColor: brand.soft }}
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800">Escova + Hidratação</div>
                  <div className="text-xs text-slate-400">45 min</div>
                </div>
                <div
                  className="text-sm font-bold transition-colors duration-300"
                  style={{ color: brand.value }}
                >
                  R$ 90
                </div>
              </div>

              {/* Botão agendar — usa a cor da marca */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white transition-colors duration-300"
                style={{ backgroundColor: brand.value }}
              >
                Agendar agora
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

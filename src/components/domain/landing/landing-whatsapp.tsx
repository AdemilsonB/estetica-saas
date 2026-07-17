// src/components/domain/landing/landing-whatsapp.tsx
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'

const BUBBLES: { side: 'in' | 'out'; text: string; delay: number }[] = [
  { side: 'in', text: 'Oi Marina! 💜 Confirmando seu horário de amanhã 14h — Escova + Hidratação. Está de pé?', delay: 0.2 },
  { side: 'out', text: 'Tá sim! Obrigada 😊', delay: 0.5 },
  { side: 'in', text: 'Perfeito, te espero! Qualquer coisa é só responder por aqui. ✨', delay: 0.8 },
]

export function LandingWhatsApp() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="bg-[#111827] px-4 py-16 text-white sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-[#25D366]">Enquanto você atende</p>
          <h2 className="font-display mt-3 text-[clamp(1.6rem,4.5vw,2.4rem)] font-extrabold">
            O WhatsApp trabalha sozinho — com a sua voz
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300 sm:text-lg">
            Você configura uma vez o tom das mensagens. Depois é o Agendê que confirma, lembra
            24h antes, avisa a lista de espera e chama de volta quem sumiu.
          </p>
          <Link
            href="/login?tab=signup"
            className="mt-6 inline-block rounded-xl bg-[#25D366] px-6 py-3.5 text-sm font-extrabold text-[#111827] transition-colors hover:bg-[#1eb857]"
          >
            Quero automatizar meu WhatsApp
          </Link>
        </div>

        <div className="rounded-2xl bg-[#0b141a] p-5 shadow-2xl shadow-black/40">
          <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-sm font-extrabold">
              SB
            </span>
            <div>
              <div className="text-sm font-bold">Studio Bella</div>
              <div className="text-xs text-[#25D366]">online</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {BUBBLES.map((b, i) => (
              <motion.div
                key={i}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: reduceMotion ? 0 : b.delay, duration: 0.35 }}
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  b.side === 'in'
                    ? 'self-start rounded-bl-sm bg-[#1f2c33]'
                    : 'self-end rounded-br-sm bg-[#005c4b]'
                }`}
              >
                {b.text}
              </motion.div>
            ))}
            <span className="mt-1 self-center rounded-full bg-white/5 px-3 py-1 text-[11px] text-slate-400">
              enviado automaticamente pelo Agendê
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

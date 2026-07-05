import { PlanName } from '@prisma/client'
import { CAPABILITY_GROUPS } from './capability-registry'

export type LimitKind = 'hard' | 'soft'

export type LimitMeta = {
  label: string
  unit: string
  benefitLabel: (value: number) => string
  unlimitedThreshold: number
  kind: LimitKind
  group: string
  defaults: Record<PlanName, number>
}

const UNLIMITED = 999999

function fmt(value: number): string {
  return value.toLocaleString('pt-BR')
}

export const LIMIT_REGISTRY = {
  max_roles: {
    label: 'Máximo de cargos',
    unit: 'cargos',
    benefitLabel: (v) => (v >= 999 ? 'Cargos ilimitados' : `${fmt(v)} cargos`),
    unlimitedThreshold: 999,
    kind: 'hard',
    group: CAPABILITY_GROUPS.ACESSO,
    defaults: { FREE: 3, STARTER: 3, PRO: 5, ENTERPRISE: 999 },
  },
  max_users: {
    label: 'Máximo de usuários',
    unit: 'usuários',
    benefitLabel: (v) => (v >= 999 ? 'Profissionais ilimitados' : `Até ${fmt(v)} profissionais`),
    unlimitedThreshold: 999,
    kind: 'hard',
    group: CAPABILITY_GROUPS.ACESSO,
    defaults: { FREE: 2, STARTER: 5, PRO: 20, ENTERPRISE: 999 },
  },
  max_appointments_month: {
    label: 'Agendamentos/mês',
    unit: 'agend.',
    benefitLabel: (v) => (v >= UNLIMITED ? 'Agendamentos ilimitados' : `${fmt(v)} agendamentos/mês`),
    unlimitedThreshold: UNLIMITED,
    kind: 'soft',
    group: CAPABILITY_GROUPS.OPERACAO,
    defaults: { FREE: 50, STARTER: 300, PRO: 2000, ENTERPRISE: UNLIMITED },
  },
  max_whatsapp_month: {
    label: 'WhatsApp/mês',
    unit: 'msgs',
    benefitLabel: (v) => (v >= UNLIMITED ? 'WhatsApp ilimitado' : `${fmt(v)} mensagens WhatsApp/mês`),
    unlimitedThreshold: UNLIMITED,
    kind: 'hard',
    group: CAPABILITY_GROUPS.COMUNICACAO,
    defaults: { FREE: 0, STARTER: 500, PRO: 2000, ENTERPRISE: 5000 },
  },
  max_email_month: {
    label: 'E-mails/mês',
    unit: 'e-mails',
    benefitLabel: (v) => (v >= UNLIMITED ? 'E-mails ilimitados' : `${fmt(v)} e-mails/mês`),
    unlimitedThreshold: UNLIMITED,
    kind: 'hard',
    group: CAPABILITY_GROUPS.COMUNICACAO,
    defaults: { FREE: 100, STARTER: 500, PRO: 5000, ENTERPRISE: UNLIMITED },
  },
} satisfies Record<string, LimitMeta>

export type LimitKey = keyof typeof LIMIT_REGISTRY

export function getLimitsByGroup(): Record<string, Array<[LimitKey, LimitMeta]>> {
  const out: Record<string, Array<[LimitKey, LimitMeta]>> = {}
  for (const [key, meta] of Object.entries(LIMIT_REGISTRY) as Array<[LimitKey, LimitMeta]>) {
    ;(out[meta.group] ??= []).push([key, meta])
  }
  return out
}

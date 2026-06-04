import { PlanName } from '@prisma/client'

export const LIMIT_REGISTRY = {
  max_roles: {
    label: 'Máximo de cargos',
    unit: 'cargos',
    defaults: { FREE: 3, STARTER: 3, PRO: 5, ENTERPRISE: 999 } as Record<PlanName, number>,
  },
  max_users: {
    label: 'Máximo de usuários',
    unit: 'usuários',
    defaults: { FREE: 2, STARTER: 5, PRO: 20, ENTERPRISE: 999 } as Record<PlanName, number>,
  },
  max_units: {
    label: 'Máximo de unidades',
    unit: 'unidades',
    defaults: { FREE: 1, STARTER: 1, PRO: 3, ENTERPRISE: 999 } as Record<PlanName, number>,
  },
  max_appointments_month: {
    label: 'Agendamentos/mês',
    unit: 'agend.',
    defaults: { FREE: 50, STARTER: 300, PRO: 2000, ENTERPRISE: 999999 } as Record<PlanName, number>,
  },
  max_whatsapp_month: {
    label: 'WhatsApp/mês',
    unit: 'msgs',
    defaults: { FREE: 0, STARTER: 500, PRO: 2000, ENTERPRISE: 5000 } as Record<PlanName, number>,
  },
  max_email_month: {
    label: 'E-mails/mês',
    unit: 'e-mails',
    defaults: { FREE: 100, STARTER: 500, PRO: 5000, ENTERPRISE: 999999 } as Record<PlanName, number>,
  },
} as const

export type LimitKey = keyof typeof LIMIT_REGISTRY

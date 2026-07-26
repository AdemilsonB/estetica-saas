import { config } from 'dotenv'
import { resolve } from 'path'

// Mesma precedência que o Next.js usa: `.env.local` vence, `.env` preenche o que faltar.
// O dotenv não sobrescreve variável já definida, então a ordem abaixo é o que garante isso.
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL) {
  console.error('[backfill] DATABASE_URL não definida em .env.local nem em .env.')
  process.exit(1)
}

import { PrismaPg } from '@prisma/adapter-pg'
import { Prisma, PrismaClient } from '@prisma/client'

import { CUSTOMER_MESSAGE_CATALOG } from '../src/domains/notifications/customer-messages/customer-message-catalog'
import { buildLegacyBody } from '../src/domains/notifications/customer-messages/legacy-template-backfill'
import type { LegacyWhatsAppConfig } from '../src/domains/notifications/customer-messages/legacy-template-backfill'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as never)

/**
 * Converte `Tenant.whatsappTemplateConfig` (a configuração legada, com os fragmentos
 * `mensagemPrincipal`/`mensagemFinal`) em registros de `CustomerMessageTemplate`,
 * preservando exatamente o texto que cada tenant já customizou.
 *
 * Só cria registro para evento que o tenant REALMENTE personalizou. Quem nunca mexeu
 * continua sem registro e cai no catálogo — é o que permite melhorarmos os textos padrão
 * depois sem precisar de outro backfill.
 *
 * Idempotente: rodar de novo não duplica nem sobrescreve personalização feita depois.
 */
async function main() {
  const soConta = process.argv.includes('--dry-run')

  const tenants = await prisma.tenant.findMany({
    where: { whatsappTemplateConfig: { not: Prisma.DbNull } },
    select: { id: true, name: true, whatsappTemplateConfig: true },
  })

  console.log(`[backfill] ${tenants.length} tenants com configuração legada`)
  if (soConta) console.log('[backfill] MODO DRY-RUN — nada será gravado')

  let criados = 0
  let jaExistiam = 0

  for (const tenant of tenants) {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      const body = buildLegacyBody(
        entrada.event,
        tenant.whatsappTemplateConfig as LegacyWhatsAppConfig | null,
      )
      if (!body) continue

      const jaExiste = await prisma.customerMessageTemplate.findFirst({
        where: { tenantId: tenant.id, event: entrada.event, channel: 'WHATSAPP' },
        select: { id: true },
      })

      if (jaExiste) {
        jaExistiam++
        continue
      }

      console.log(`[backfill] ${tenant.name} → ${entrada.event}`)

      if (!soConta) {
        await prisma.customerMessageTemplate.create({
          data: {
            tenantId: tenant.id,
            event: entrada.event,
            channel: 'WHATSAPP',
            subject: null,
            body,
            mediaUrl: null,
          },
        })
      }
      criados++
    }
  }

  console.log(
    `[backfill] ${criados} templates ${soConta ? 'seriam criados' : 'criados'}, ${jaExistiam} já existiam`,
  )
}

main()
  .catch((err) => {
    console.error('[backfill] falhou:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

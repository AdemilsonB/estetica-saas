import { prisma } from '@/shared/database/prisma'
import type { AnamneseBlocks, AnamneseHistoryEntry } from './anamnese-blocks.types'

const MAX_HISTORY = 10

export class CustomerAnamneseRepository {
  async findByCustomer(tenantId: string, customerId: string) {
    return prisma.customerAnamnese.findFirst({
      where: { tenantId, customerId },
    })
  }

  async findByTenantAndId(tenantId: string, id: string) {
    return prisma.customerAnamnese.findFirst({
      where: { tenantId, id },
    })
  }

  async upsert(
    tenantId: string,
    customerId: string,
    blockType: string,
    newBlockData: unknown,
  ) {
    const existing = await this.findByCustomer(tenantId, customerId)

    const now = new Date().toISOString()

    if (!existing) {
      const blocks = { [blockType]: newBlockData } as AnamneseBlocks
      return prisma.customerAnamnese.create({
        data: {
          tenantId,
          customerId,
          blocks,
          blockTypes: [blockType],
          version: 1,
          history: [{ version: 1, blocks, savedAt: now }] as AnamneseHistoryEntry[],
        },
      })
    }

    const currentBlocks = (existing.blocks as AnamneseBlocks) ?? {}
    const updatedBlocks = { ...currentBlocks, [blockType]: newBlockData }
    const newVersion = existing.version + 1

    const currentHistory = (existing.history as AnamneseHistoryEntry[]) ?? []
    const snapshot: AnamneseHistoryEntry = {
      version: newVersion,
      blocks: updatedBlocks,
      savedAt: now,
    }
    const updatedHistory = [...currentHistory, snapshot].slice(-MAX_HISTORY)

    const blockTypes = Array.from(new Set([...existing.blockTypes, blockType]))

    return prisma.customerAnamnese.update({
      where: { id: existing.id },
      data: {
        blocks: updatedBlocks,
        blockTypes,
        version: newVersion,
        history: updatedHistory,
      },
    })
  }
}

export const customerAnamneseRepository = new CustomerAnamneseRepository()

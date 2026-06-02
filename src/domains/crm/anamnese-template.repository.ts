import { prisma } from "@/shared/database/prisma"
import {
  DEFAULT_ANAMNESE_FIELDS,
  DEFAULT_LINK_MESSAGE,
  type FieldDef,
  type UpdateAnamneseTemplateInput,
} from "./types"

export class AnamneseTemplateRepository {
  async findOrCreate(tenantId: string) {
    const existing = await prisma.anamneseTemplate.findUnique({
      where: { tenantId },
    })

    if (existing) return existing

    return prisma.anamneseTemplate.create({
      data: {
        tenantId,
        fields: DEFAULT_ANAMNESE_FIELDS as unknown as object[],
        linkMessage: DEFAULT_LINK_MESSAGE,
      },
    })
  }

  async update(tenantId: string, input: UpdateAnamneseTemplateInput) {
    return prisma.anamneseTemplate.upsert({
      where: { tenantId },
      create: {
        tenantId,
        fields: input.fields as unknown as object[],
        linkMessage: input.linkMessage ?? DEFAULT_LINK_MESSAGE,
      },
      update: {
        fields: input.fields as unknown as object[],
        linkMessage: input.linkMessage,
      },
    })
  }
}

export const anamneseTemplateRepository = new AnamneseTemplateRepository()

export function parseFields(raw: unknown): FieldDef[] {
  if (!Array.isArray(raw)) return DEFAULT_ANAMNESE_FIELDS
  return raw as FieldDef[]
}

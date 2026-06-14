import { z } from 'zod'

const quandoSchema = z.enum(['menos_30_dias', '30_90_dias', '3_6_meses', 'mais_6_meses'])
const quimicaItemSchema = z.object({
  feito: z.boolean(),
  quando: quandoSchema.optional(),
})

export const capilarBlockSchema = z.object({
  // Sub-seção A: Comprimento e estrutura
  comprimento: z.enum(['nuca', 'ombro', 'meio_costas', 'cintura', 'mais_cintura']).optional(),
  tipoFio: z.enum(['liso', 'ondulado', 'cacheado', 'crespo']).optional(),
  espessura: z.enum(['fino', 'medio', 'grosso']).optional(),
  // Sub-seção B: Histórico químico
  coloracao: quimicaItemSchema.optional(),
  descoloracao: quimicaItemSchema.optional(),
  progressiva: quimicaItemSchema.optional(),
  botox: quimicaItemSchema.optional(),
  outroQuimico: z.string().max(100).optional(),
  // Sub-seção C: Cuidados atuais
  produtos: z.array(z.string().max(100)).max(10).default([]),
  frequenciaLavagem: z.enum(['diario', '2_3_semana', '1_semana', 'menos_semana']).optional(),
  usoTermico: z.enum(['nunca', 'raramente', '2_3_semana', 'diario']).optional(),
  // Sub-seção D: Fotos (frente, lado, atrás)
  photoFront: z.string().url().optional(),
  photoSide: z.string().url().optional(),
  photoBack: z.string().url().optional(),
  // Sub-seção E: Objetivo
  objetivos: z.array(z.enum(['mudar_cor', 'hidratar', 'alisar', 'manutencao', 'corte', 'outro'])).default([]),
  descricaoLivre: z.string().max(500).optional(),
})
export type CapilarBlock = z.infer<typeof capilarBlockSchema>

// Estrutura extensível: adicionar novos tipos de bloco aqui no futuro
export const anamneseBlocksSchema = z.object({
  capilar: capilarBlockSchema.optional(),
  // facial: facialBlockSchema.optional(),  ← exemplo de extensão futura
})
export type AnamneseBlocks = z.infer<typeof anamneseBlocksSchema>

export type AnamneseBlockType = keyof AnamneseBlocks

export type AnamneseHistoryEntry = {
  version: number
  blocks: AnamneseBlocks
  savedAt: string
}

// Schema para submissão pública (booking)
export const submitAnamneseSchema = z.object({
  phone: z.string().min(8).max(30),
  blockType: z.literal('capilar'),
  data: capilarBlockSchema,
})
export type SubmitAnamneseInput = z.infer<typeof submitAnamneseSchema>

// Schema para atualização pelo profissional
export const saveAnamneseProfessionalSchema = z.object({
  blockType: z.enum(['capilar']),
  data: capilarBlockSchema,
})
export type SaveAnamneseProfessionalInput = z.infer<typeof saveAnamneseProfessionalSchema>

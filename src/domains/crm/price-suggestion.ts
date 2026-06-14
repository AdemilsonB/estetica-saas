import type { AnamneseBlocks, CapilarBlock } from './anamnese-blocks.types'

export type AjustePreco = {
  motivo: string
  valorAdicional: number
}

export type SugestaoPreco = {
  valorBase: number
  valorSugerido: number
  ajustes: AjustePreco[]
}

const COMPRIMENTO_ACRESCIMO: Record<string, number> = {
  nuca:         0,
  ombro:        0,
  meio_costas:  0.15,
  cintura:      0.30,
  mais_cintura: 0.50,
}

const COMPRIMENTO_LABEL: Record<string, string> = {
  meio_costas:  'Comprimento médio (meio das costas)',
  cintura:      'Comprimento longo (cintura)',
  mais_cintura: 'Comprimento muito longo (além da cintura)',
}

function temQuimicaRecente(capilar: CapilarBlock): boolean {
  const campos = [capilar.coloracao, capilar.descoloracao, capilar.progressiva, capilar.botox]
  return campos.some((c) => c?.feito && c.quando === 'menos_30_dias')
}

export function calcularSugestaoPreco(
  valorBase: number,
  blocks: AnamneseBlocks,
): SugestaoPreco | null {
  const capilar = blocks.capilar
  if (!capilar?.comprimento) return null

  const ajustes: AjustePreco[] = []
  let valorSugerido = valorBase

  const pctComprimento = COMPRIMENTO_ACRESCIMO[capilar.comprimento] ?? 0
  if (pctComprimento > 0) {
    const valor = Math.round(valorBase * pctComprimento)
    ajustes.push({ motivo: COMPRIMENTO_LABEL[capilar.comprimento]!, valorAdicional: valor })
    valorSugerido += valor
  }

  if (temQuimicaRecente(capilar)) {
    const valor = Math.round(valorBase * 0.15)
    ajustes.push({ motivo: 'Química recente (< 30 dias) — risco de ressecamento', valorAdicional: valor })
    valorSugerido += valor
  }

  return { valorBase, valorSugerido, ajustes }
}

export const FINANCIAL_CATEGORIES = {
  SERVICE:         'Serviço',
  PRODUCT_SALE:    'Venda de Produto',
  STOCK_PURCHASE:  'Compra de Estoque',
  SUPPLY_USE:      'Insumo de Atendimento',
  COURTESY:        'Cortesia',
  FIXED_EXPENSE:   'Despesa Fixa',
  VARIABLE:        'Despesa Variável',
  SUPPLY_REVERSAL: 'Estorno de Insumo',
} as const

export type FinancialCategory = typeof FINANCIAL_CATEGORIES[keyof typeof FINANCIAL_CATEGORIES]

export function isReversal(category: string, amount: number): boolean {
  return category === FINANCIAL_CATEGORIES.SUPPLY_REVERSAL || amount < 0
}

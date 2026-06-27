function calcCnpjDigit(digits: string, weights: number[]): number {
  let sum = 0
  for (let i = 0; i < weights.length; i++) {
    sum += Number(digits[i]) * weights[i]
  }
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function validarCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')

  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false

  const firstDigit = calcCnpjDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  if (firstDigit !== Number(digits[12])) return false

  const secondDigit = calcCnpjDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  if (secondDigit !== Number(digits[13])) return false

  return true
}

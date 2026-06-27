function calcCpfDigit(digits: string, length: number): number {
  let sum = 0
  for (let i = 0; i < length; i++) {
    sum += Number(digits[i]) * (length + 1 - i)
  }
  const remainder = (sum * 10) % 11
  return remainder === 10 ? 0 : remainder
}

export function validarCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')

  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  const firstDigit = calcCpfDigit(digits, 9)
  if (firstDigit !== Number(digits[9])) return false

  const secondDigit = calcCpfDigit(digits, 10)
  if (secondDigit !== Number(digits[10])) return false

  return true
}

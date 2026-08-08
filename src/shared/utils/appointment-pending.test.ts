import { describe, it, expect } from 'vitest'
import { computePendingCompletionCutoff, isPendingCompletion } from './appointment-pending'

const NOW = new Date('2026-06-15T12:00:00Z')

describe('computePendingCompletionCutoff', () => {
  it('subtrai graceHours do agora', () => {
    expect(computePendingCompletionCutoff(24, NOW)).toEqual(new Date('2026-06-14T12:00:00Z'))
    expect(computePendingCompletionCutoff(6, NOW)).toEqual(new Date('2026-06-15T06:00:00Z'))
  })
})

describe('isPendingCompletion', () => {
  it('não é pendente quando o status já é final (COMPLETED/CANCELLED/NO_SHOW)', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW']) {
      expect(
        isPendingCompletion({ status, endsAt: '2026-06-01T10:00:00Z' }, 24, NOW),
      ).toBe(false)
    }
  })

  it('não é pendente quando ainda está dentro do prazo de tolerância', () => {
    // Terminou há 2h, tolerância de 24h — ainda não venceu.
    expect(
      isPendingCompletion(
        { status: 'SCHEDULED', endsAt: '2026-06-15T10:00:00Z' },
        24,
        NOW,
      ),
    ).toBe(false)
  })

  it('é pendente quando passou do prazo de tolerância e não foi concluído', () => {
    // Terminou há 30h, tolerância de 24h — vencido.
    expect(
      isPendingCompletion(
        { status: 'CONFIRMED', endsAt: '2026-06-14T06:00:00Z' },
        24,
        NOW,
      ),
    ).toBe(true)
  })

  it('não é pendente enquanto o lembrete estiver adiado (completionSnoozedUntil no futuro)', () => {
    expect(
      isPendingCompletion(
        {
          status: 'SCHEDULED',
          endsAt: '2026-06-14T06:00:00Z',
          completionSnoozedUntil: '2026-06-20T00:00:00Z',
        },
        24,
        NOW,
      ),
    ).toBe(false)
  })

  it('volta a ser pendente quando o prazo do adiamento já passou', () => {
    expect(
      isPendingCompletion(
        {
          status: 'SCHEDULED',
          endsAt: '2026-06-14T06:00:00Z',
          completionSnoozedUntil: '2026-06-10T00:00:00Z',
        },
        24,
        NOW,
      ),
    ).toBe(true)
  })
})

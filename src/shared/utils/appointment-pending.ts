const PENDING_STATUSES = new Set(["SCHEDULED", "CONFIRMED"]);

export function computePendingCompletionCutoff(
  graceHours: number,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() - graceHours * 60 * 60 * 1000);
}

export type PendingCompletionCheckInput = {
  status: string;
  endsAt: string | Date;
  completionSnoozedUntil?: string | Date | null;
};

/**
 * Mesma regra usada pela query do repository (Prisma) — mantida aqui para o
 * front-end (destaque na Agenda, botão "Lembrar depois" no drawer) calcular
 * sem round-trip extra, sem duplicar a fórmula do corte.
 */
export function isPendingCompletion(
  appointment: PendingCompletionCheckInput,
  graceHours: number,
  now: Date = new Date(),
): boolean {
  if (!PENDING_STATUSES.has(appointment.status)) return false;

  const cutoff = computePendingCompletionCutoff(graceHours, now);
  if (new Date(appointment.endsAt) >= cutoff) return false;

  if (appointment.completionSnoozedUntil) {
    const snoozedUntil = new Date(appointment.completionSnoozedUntil);
    if (snoozedUntil > now) return false;
  }

  return true;
}

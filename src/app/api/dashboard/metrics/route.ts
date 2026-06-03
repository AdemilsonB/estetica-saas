import { AppointmentStatus, TransactionType } from "@prisma/client";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { prisma } from "@/shared/database/prisma";
import { dayBoundsInTz, monthBoundsInTz } from "@/lib/dates";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.appointments.view);

    const tenant = await prisma.tenant.findFirstOrThrow({
      where: { id: session.tenantId },
      select: { timezone: true },
    });

    const tz = tenant.timezone ?? "America/Sao_Paulo";
    const { start: dayStart, end: dayEnd } = dayBoundsInTz(tz);
    const { start: monthStart } = monthBoundsInTz(tz);

    const [statusGroups, profGroups, revenueToday, revenueMonth] =
      await Promise.all([
        // Agendamentos do dia por status (usa startsAt — slot de tempo do atendimento)
        prisma.appointment.groupBy({
          by: ["status"],
          where: {
            tenantId: session.tenantId,
            startsAt: { gte: dayStart, lte: dayEnd },
          },
          _count: { status: true },
        }),
        // Ocupação por profissional (usa startsAt)
        prisma.appointment.groupBy({
          by: ["professionalId"],
          where: {
            tenantId: session.tenantId,
            startsAt: { gte: dayStart, lte: dayEnd },
          },
          _count: { professionalId: true },
          orderBy: { _count: { professionalId: "desc" } },
        }),
        // Receita do dia: Transaction.netAmount onde type=INCOME e paidAt no range
        // netAmount = grossAmount - desconto + gorjeta - taxa cartão (valor real recebido)
        prisma.transaction.aggregate({
          where: {
            tenantId: session.tenantId,
            type: TransactionType.INCOME,
            paidAt: { gte: dayStart, lte: dayEnd },
          },
          _sum: { netAmount: true },
        }),
        // Receita do mês: mesmo critério, range do mês
        prisma.transaction.aggregate({
          where: {
            tenantId: session.tenantId,
            type: TransactionType.INCOME,
            paidAt: { gte: monthStart, lte: dayEnd },
          },
          _sum: { netAmount: true },
        }),
      ]);

    const allStatuses: AppointmentStatus[] = [
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ];
    const byStatus = Object.fromEntries(
      allStatuses.map((s) => [
        s,
        statusGroups.find((g) => g.status === s)?._count.status ?? 0,
      ]),
    ) as Record<AppointmentStatus, number>;

    const profIds = profGroups.map((g) => g.professionalId);
    const profUsers =
      profIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: profIds } },
            select: { id: true, name: true },
          })
        : [];

    const byProfessional = profGroups.map((g) => ({
      id: g.professionalId,
      name:
        profUsers.find((u) => u.id === g.professionalId)?.name ?? "Desconhecido",
      count: g._count.professionalId,
    }));

    const revenue = {
      today: Number(revenueToday._sum.netAmount ?? 0),
      month: Number(revenueMonth._sum.netAmount ?? 0),
    };

    return Response.json({ byStatus, byProfessional, revenue });
  } catch (error) {
    return handleApiError(error);
  }
}

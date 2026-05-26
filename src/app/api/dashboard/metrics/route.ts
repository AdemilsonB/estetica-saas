import { AppointmentStatus } from "@prisma/client";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { prisma } from "@/shared/database/prisma";

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.appointments.view);

    const today = new Date();
    const dayStart = startOfDay(today);
    const dayEnd = endOfDay(today);
    const monthStart = startOfMonth(today);

    const [statusGroups, profGroups, revenueToday, revenueMonth] =
      await Promise.all([
        prisma.appointment.groupBy({
          by: ["status"],
          where: { tenantId: session.tenantId, startsAt: { gte: dayStart, lte: dayEnd } },
          _count: { status: true },
        }),
        prisma.appointment.groupBy({
          by: ["professionalId"],
          where: { tenantId: session.tenantId, startsAt: { gte: dayStart, lte: dayEnd } },
          _count: { professionalId: true },
          orderBy: { _count: { professionalId: "desc" } },
        }),
        prisma.appointment.aggregate({
          where: {
            tenantId: session.tenantId,
            status: AppointmentStatus.COMPLETED,
            startsAt: { gte: dayStart, lte: dayEnd },
          },
          _sum: { price: true },
        }),
        prisma.appointment.aggregate({
          where: {
            tenantId: session.tenantId,
            status: AppointmentStatus.COMPLETED,
            startsAt: { gte: monthStart, lte: dayEnd },
          },
          _sum: { price: true },
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
      today: Number(revenueToday._sum.price ?? 0),
      month: Number(revenueMonth._sum.price ?? 0),
    };

    return Response.json({ byStatus, byProfessional, revenue });
  } catch (error) {
    return handleApiError(error);
  }
}

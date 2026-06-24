import { z } from "zod";

import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { ForbiddenError } from "@/shared/errors";

const SUPPORTED_TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Maceio",
  "America/Bahia",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
  "America/Noronha",
] as const;

const REMINDER_LEAD_HOURS = [2, 4, 8, 12, 24, 48] as const;

const updateNotificationSettingsSchema = z.object({
  whatsappEnabled: z.boolean().optional(),
  timezone: z.enum(SUPPORTED_TIMEZONES).optional(),
  reminderLeadHours: z.number().int().refine((v) => (REMINDER_LEAD_HOURS as readonly number[]).includes(v)).optional(),
  reminderWindowStart: z.number().int().min(0).max(23).optional(),
  reminderWindowEnd: z.number().int().min(0).max(23).optional(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      include: { subscription: { select: { plan: true } } },
    });

    if (!tenant) {
      return Response.json({
        whatsappEnabled: false,
        timezone: "America/Sao_Paulo",
        plan: "FREE",
        reminderLeadHours: 24,
        reminderWindowStart: 7,
        reminderWindowEnd: 22,
      });
    }

    return Response.json({
      whatsappEnabled: tenant.whatsappEnabled,
      timezone: tenant.timezone,
      plan: tenant.subscription?.plan ?? "FREE",
      reminderLeadHours: tenant.reminderLeadHours,
      reminderWindowStart: tenant.reminderWindowStart,
      reminderWindowEnd: tenant.reminderWindowEnd,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);

    const input = await validateInput(request, updateNotificationSettingsSchema);

    if (input.whatsappEnabled === true) {
      const hasAccess = await featureGuard.canAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);
      if (!hasAccess) {
        throw new ForbiddenError("WhatsApp requer plano STARTER ou superior.");
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id: session.tenantId },
      data: input,
      include: { subscription: { select: { plan: true } } },
    });

    return Response.json({
      whatsappEnabled: tenant.whatsappEnabled,
      timezone: tenant.timezone,
      plan: tenant.subscription?.plan ?? "FREE",
      reminderLeadHours: tenant.reminderLeadHours,
      reminderWindowStart: tenant.reminderWindowStart,
      reminderWindowEnd: tenant.reminderWindowEnd,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { prisma } from "@/shared/database/prisma";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const TEMPLATE_DEFAULTS: Record<
  string,
  { mensagemPrincipal: string; mensagemFinal: string }
> = {
  confirmacao: {
    mensagemPrincipal: "Seu agendamento foi criado.",
    mensagemFinal: "Até lá!",
  },
  confirmado: {
    mensagemPrincipal: "Seu agendamento está confirmado.",
    mensagemFinal: "Te esperamos!",
  },
  lembrete: {
    mensagemPrincipal: "Lembrete:",
    mensagemFinal: "Até lá!",
  },
  cancelamento: {
    mensagemPrincipal: "Seu agendamento foi cancelado.",
    mensagemFinal: "Para reagendar, entre em contato conosco.",
  },
  nao_comparecimento: {
    mensagemPrincipal: "Notamos que você não compareceu ao seu horário.",
    mensagemFinal: "Quando quiser reagendar, estamos à disposição!",
  },
};

const updateTemplateSchema = z.object({
  template: z.enum([
    "confirmacao",
    "confirmado",
    "lembrete",
    "cancelamento",
    "nao_comparecimento",
  ]),
  mensagemPrincipal: z.string().min(1).max(120),
  mensagemFinal: z.string().min(1).max(80),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { whatsappTemplateConfig: true },
    });

    const savedConfig = (tenant?.whatsappTemplateConfig ?? {}) as Record<
      string,
      { mensagemPrincipal?: string; mensagemFinal?: string }
    >;

    const result = Object.fromEntries(
      Object.entries(TEMPLATE_DEFAULTS).map(([key, defaults]) => [
        key,
        {
          mensagemPrincipal:
            savedConfig[key]?.mensagemPrincipal ?? defaults.mensagemPrincipal,
          mensagemFinal:
            savedConfig[key]?.mensagemFinal ?? defaults.mensagemFinal,
        },
      ]),
    );

    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    const input = await validateInput(request, updateTemplateSchema);

    const current = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { whatsappTemplateConfig: true },
    });

    const existing = (current?.whatsappTemplateConfig ?? {}) as Record<
      string,
      unknown
    >;

    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: {
        whatsappTemplateConfig: {
          ...existing,
          [input.template]: {
            mensagemPrincipal: input.mensagemPrincipal,
            mensagemFinal: input.mensagemFinal,
          },
        },
      },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}

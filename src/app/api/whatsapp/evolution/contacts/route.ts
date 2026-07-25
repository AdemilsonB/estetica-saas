import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { prisma } from "@/shared/database/prisma";
import { getSessionContext } from "@/shared/auth/session";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { handleApiError } from "@/shared/http/handle-api-error";
import { evolutionProvider } from "@/domains/notifications/providers/evolution.provider";
import { customerRepository } from "@/domains/crm/customer.repository";
import { ValidationError } from "@/shared/errors";
import {
  buildPreviewPhoneVariants,
  normalizeImportedPhone,
} from "@/shared/utils/vcard";

// Extrai número local (sem DDI) de IDs como "5511999999999@s.whatsapp.net"
function extractPhone(id: string): string | null {
  const match = id.match(/^(\d{10,13})@s\.whatsapp\.net$/);
  if (!match) return null;
  const digits = match[1];
  // Apenas números brasileiros (55 + 10 ou 11 dígitos)
  if (!/^55\d{10,11}$/.test(digits)) return null;
  return normalizeImportedPhone(digits);
}

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.view);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    const tenant = await prisma.tenant.findFirst({
      where: { id: session.tenantId },
      select: { evolutionInstanceId: true, evolutionConnected: true },
    });

    if (!tenant?.evolutionInstanceId || !tenant.evolutionConnected) {
      throw new ValidationError("WhatsApp não está conectado para este tenant.");
    }

    const rawContacts = await evolutionProvider.getContacts(tenant.evolutionInstanceId);

    const contacts = rawContacts
      .map((c) => ({
        phone: extractPhone(c.id),
        name: c.pushName || "",
        profilePicUrl: c.profilePicUrl ?? null,
      }))
      .filter(
        (c): c is { phone: string; name: string; profilePicUrl: string | null } =>
          c.phone !== null,
      );

    // Casa clientes gravados com ou sem DDI 55 (cadastro manual × imports antigos)
    const variants = buildPreviewPhoneVariants(contacts.map((c) => c.phone));
    const existing = await customerRepository.findByPhones(session.tenantId, variants);
    const existingPhones = new Set(
      existing.map((e) => e.phone).filter((p): p is string => p !== null),
    );

    const result = contacts.map((c) => ({
      phone: c.phone,
      name: c.name,
      profilePicUrl: c.profilePicUrl,
      inCrm: existingPhones.has(c.phone) || existingPhones.has("55" + c.phone),
    }));

    return Response.json({ contacts: result, total: result.length });
  } catch (error) {
    return handleApiError(error);
  }
}

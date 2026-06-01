import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { prisma } from "@/shared/database/prisma";
import { getSessionContext } from "@/shared/auth/session";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { handleApiError } from "@/shared/http/handle-api-error";
import { evolutionProvider } from "@/domains/notifications/providers/evolution.provider";
import { customerRepository } from "@/domains/crm/customer.repository";
import { ValidationError } from "@/shared/errors";

// Extrai número E.164 (dígitos) de IDs como "5511999999999@s.whatsapp.net"
function extractPhone(id: string): string | null {
  const match = id.match(/^(\d{10,13})@s\.whatsapp\.net$/);
  if (!match) return null;
  const digits = match[1];
  // Apenas números brasileiros (55 + 10 ou 11 dígitos)
  if (!/^55\d{10,11}$/.test(digits)) return null;
  return digits;
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
      .map((c) => ({ phone: extractPhone(c.id), name: c.pushName || "Contato" }))
      .filter((c): c is { phone: string; name: string } => c.phone !== null);

    const phones = contacts.map((c) => c.phone);
    const existing = await customerRepository.findByPhones(session.tenantId, phones);
    const existingPhones = new Set(existing.map((e) => e.phone).filter(Boolean) as string[]);

    const result = contacts.map((c) => ({
      phone: c.phone,
      name: c.name,
      inCrm: existingPhones.has(c.phone),
    }));

    return Response.json({ contacts: result, total: result.length });
  } catch (error) {
    return handleApiError(error);
  }
}

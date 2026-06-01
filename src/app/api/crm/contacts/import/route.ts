import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { prisma } from "@/shared/database/prisma";
import { getSessionContext } from "@/shared/auth/session";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { customerRepository } from "@/domains/crm/customer.repository";

const importContactsSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        phone: z.string().trim().min(8).max(30),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.customers.create);
    await featureGuard.assertAccess(session.tenantId, FEATURES.WHATSAPP_BASIC);

    const input = await validateInput(request, importContactsSchema);

    const phones = input.contacts.map((c) => c.phone);
    const existing = await customerRepository.findByPhones(session.tenantId, phones);
    const existingPhones = new Set(existing.map((e) => e.phone).filter(Boolean) as string[]);

    const toCreate = input.contacts.filter((c) => !existingPhones.has(c.phone));

    let created = 0;
    const errors: string[] = [];

    for (const contact of toCreate) {
      try {
        await prisma.customer.create({
          data: {
            tenantId: session.tenantId,
            name: contact.name,
            phone: contact.phone,
            consentGiven: false,
            consentOrigin: "whatsapp_import",
            tags: [],
          },
        });
        created++;
      } catch {
        errors.push(contact.phone);
      }
    }

    const skipped = input.contacts.length - toCreate.length;

    return Response.json({ created, skipped, errors }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

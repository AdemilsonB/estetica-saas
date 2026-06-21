import { z } from "zod";
import { customerRepository } from "@/domains/crm/customer.repository";
import { prisma } from "@/shared/database/prisma";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const importSchema = z.object({
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

    const { contacts } = await validateInput(request, importSchema);

    const phones = contacts.map((c) => c.phone);
    const existing = await customerRepository.findByPhones(session.tenantId, phones);
    const existingPhoneSet = new Set(existing.map((c) => c.phone).filter(Boolean));

    const newContacts = contacts.filter((c) => !existingPhoneSet.has(c.phone));

    if (newContacts.length > 0) {
      await prisma.customer.createMany({
        data: newContacts.map(({ name, phone }) => ({
          tenantId: session.tenantId,
          name,
          phone,
        })),
        skipDuplicates: true,
      });
    }

    const created = newContacts.length;
    const skipped = contacts.length - newContacts.length;

    return Response.json({ created, skipped });
  } catch (error) {
    return handleApiError(error);
  }
}

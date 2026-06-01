import { z } from "zod";
import { DiscountApplyType } from "@prisma/client";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { discountTypeRepository } from "@/domains/financial/discount-type.repository";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  type: z.nativeEnum(DiscountApplyType).optional(),
  defaultValue: z.number().min(0).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const { id } = await params;
    const input = await validateInput(request, patchSchema);
    await discountTypeRepository.update(session.tenantId, id, input);
    return Response.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const { id } = await params;
    await discountTypeRepository.delete(session.tenantId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}

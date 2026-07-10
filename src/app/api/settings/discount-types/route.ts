import { z } from "zod";
import { DiscountApplyType } from "@prisma/client";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { discountTypeRepository } from "@/domains/financial/discount-type.repository";

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  type: z.nativeEnum(DiscountApplyType),
  defaultValue: z.number().min(0).optional(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "descontos", "view");
    const url = new URL(request.url);
    const onlyActive = url.searchParams.get("active") === "true";
    const result = await discountTypeRepository.list(session.tenantId, onlyActive);
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "descontos", "edit");
    const input = await validateInput(request, createSchema);
    const result = await discountTypeRepository.create(session.tenantId, input);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

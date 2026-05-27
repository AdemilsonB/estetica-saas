import { z } from "zod";
import { iamService } from "@/domains/iam/iam.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getVerifiedUserId } from "@/integrations/supabase/auth";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { UnauthorizedError } from "@/shared/errors";

const RegisterSchema = z.object({
  businessName: z.string().min(2, "Nome do negocio muito curto"),
  userName: z.string().min(2, "Nome muito curto"),
});

export async function POST(req: Request) {
  initializeDomainRuntime();

  try {
    // Registro precede a existência do tenant — usa validação leve sem exigir tenantId
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Token ausente.");
    }
    const accessToken = authHeader.slice(7).trim();
    const userId = await getVerifiedUserId(accessToken);

    const input = await validateInput(req, RegisterSchema);
    const result = await iamService.register(userId, input);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

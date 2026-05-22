import { z } from "zod";
import { iamService } from "@/domains/iam/iam.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

const RegisterSchema = z.object({
  businessName: z.string().min(2, "Nome do negocio muito curto"),
  userName: z.string().min(2, "Nome muito curto"),
});

export async function POST(req: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(req);
    const input = await validateInput(req, RegisterSchema);
    const result = await iamService.register(session.userId, input);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

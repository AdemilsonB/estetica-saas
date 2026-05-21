import { iamService } from "@/domains/iam/iam.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";

export async function GET(request: Request) {
  initializeDomainRuntime();

  try {
    const session = await getSessionContext(request);
    const user = await iamService.getCurrentUser(session);
    return Response.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}

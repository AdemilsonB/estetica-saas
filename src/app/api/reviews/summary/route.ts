import { reviewService } from "@/domains/reviews/review.service";
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";

/** Resumo de avaliações para o dono (média, distribuição, % ao Google, feedbacks). */
export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, "clientes", "view");
    const summary = await reviewService.getSummary(session.tenantId);
    return Response.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

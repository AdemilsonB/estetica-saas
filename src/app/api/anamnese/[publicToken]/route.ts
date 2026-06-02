import { anamneseService } from "@/domains/crm/anamnese.service";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { submitPublicAnamneseSchema } from "@/domains/crm/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  try {
    const { publicToken } = await params;
    const data = await anamneseService.getPublicAnamnese(publicToken);
    return Response.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  try {
    const { publicToken } = await params;
    const input = await validateInput(request, submitPublicAnamneseSchema);
    const result = await anamneseService.submitPublic(publicToken, input.data);
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

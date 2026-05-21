import type { ZodType } from "zod";
import { ZodError } from "zod";

import { ValidationError } from "@/shared/errors";

export async function validateInput<TOutput>(
  request: Request,
  schema: ZodType<TOutput>,
): Promise<TOutput> {
  try {
    const body = (await request.json()) as unknown;
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError("Payload invalido.", error.flatten());
    }

    throw error;
  }
}

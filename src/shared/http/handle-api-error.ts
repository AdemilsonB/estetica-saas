import { Prisma } from "@prisma/client";

import { ConflictError, DomainError } from "@/shared/errors";

export function handleApiError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const conflict = new ConflictError("Registro duplicado.", error.meta);
      return Response.json(
        {
          error: {
            code: conflict.code,
            message: conflict.message,
            details: conflict.details,
          },
        },
        { status: conflict.statusCode },
      );
    }
  }

  if (error instanceof DomainError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode },
    );
  }

  return Response.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Ocorreu um erro interno.",
      },
    },
    { status: 500 },
  );
}

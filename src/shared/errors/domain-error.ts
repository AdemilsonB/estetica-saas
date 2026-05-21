export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Nao autorizado.") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Acesso negado.") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super(`${resource} nao encontrado.`, "NOT_FOUND", 404, { resource });
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, "CONFLICT", 409, details);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 422, details);
  }
}

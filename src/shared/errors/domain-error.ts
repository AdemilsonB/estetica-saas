import type { PlanName } from "@prisma/client";

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

// --- Scheduling ---

export class SlotUnavailableError extends DomainError {
  constructor() {
    super("Horario nao disponivel para este profissional.", "SLOT_UNAVAILABLE", 409);
  }
}

export class AppointmentNotFoundError extends DomainError {
  constructor() {
    super("Agendamento nao encontrado.", "APPOINTMENT_NOT_FOUND", 404);
  }
}

export class ServiceNotFoundError extends DomainError {
  constructor() {
    super("Servico nao encontrado.", "SERVICE_NOT_FOUND", 404);
  }
}

// --- CRM ---

export class CustomerNotFoundError extends DomainError {
  constructor() {
    super("Cliente nao encontrado.", "CUSTOMER_NOT_FOUND", 404);
  }
}

// --- IAM ---

export class UserNotFoundError extends DomainError {
  constructor() {
    super("Usuario nao encontrado.", "USER_NOT_FOUND", 404);
  }
}

export class ProfessionalNotFoundError extends DomainError {
  constructor() {
    super("Profissional nao encontrado ou nao pertence a este tenant.", "PROFESSIONAL_NOT_FOUND", 404);
  }
}

// --- Billing ---

export class PlanFeatureError extends DomainError {
  constructor(
    public readonly feature: string,
    public readonly requiredPlan: PlanName,
  ) {
    super(
      `Feature "${feature}" requer plano ${requiredPlan} ou superior`,
      "PLAN_FEATURE_REQUIRED",
      403,
      { feature, requiredPlan },
    );
  }
}

export class PlanLimitError extends DomainError {
  constructor(
    public readonly limitType: string,
    public readonly limit: number,
    public readonly current: number,
  ) {
    super(
      `Limite de ${limitType} atingido (${current}/${limit})`,
      "PLAN_LIMIT_EXCEEDED",
      402,
      { limitType, limit, current },
    );
  }
}

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

export class RateLimitExceededError extends DomainError {
  constructor(message = "Limite de requisições excedido. Tente novamente em breve.") {
    super(message, "RATE_LIMIT_EXCEEDED", 429);
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

export class AppointmentAlreadyCancelledError extends DomainError {
  constructor() {
    super(
      "Agendamento não pode ser remarcado com o status atual.",
      "APPOINTMENT_NOT_RESCHEDULABLE",
      422,
    );
  }
}

export class RefundNotAllowedError extends DomainError {
  constructor(message = "Estorno não permitido para este agendamento.") {
    super(message, "REFUND_NOT_ALLOWED", 422);
  }
}

export class AppointmentAlreadyPaidError extends DomainError {
  constructor() {
    super("Este agendamento já possui pagamento registrado.", "APPOINTMENT_ALREADY_PAID", 409);
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

export class TrialAlreadyUsedError extends DomainError {
  constructor() {
    super(
      "Este negócio já utilizou o período de teste gratuito. Escolha um plano para assinar.",
      "TRIAL_ALREADY_USED",
      409,
    );
  }
}

const LIMIT_TYPE_TO_CAPABILITY: Record<string, string> = {
  users: "equipe",
  appointments_month: "agenda",
  // demais limites entram na Fase D
};

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
      {
        limitType,
        limit,
        current,
        // `null` quando o limitType não tem capability gateável mapeada ainda é intencional:
        // os demais limites ganham capability real na Fase D.
        capability: LIMIT_TYPE_TO_CAPABILITY[limitType] ?? null,
      },
    );
  }
}

export class InvalidPhoneError extends DomainError {
  constructor(phone: string) {
    super(
      `Número de telefone inválido: "${phone}". Esperado formato brasileiro (10-13 dígitos).`,
      "INVALID_PHONE",
      422,
      { phone },
    );
  }
}

// --- Inventory ---

export class ProductNotFoundError extends DomainError {
  constructor() {
    super('Produto não encontrado.', 'PRODUCT_NOT_FOUND', 404)
  }
}

export class InsufficientStockError extends DomainError {
  constructor(available: number, requested: number, productName?: string) {
    const prefix = productName ? `${productName}: ` : ''
    super(
      `${prefix}estoque insuficiente. Disponível: ${available}, solicitado: ${requested}.`,
      'INSUFFICIENT_STOCK',
      422,
      { available, requested, productName },
    )
  }
}

export class CategoryHasProductsError extends DomainError {
  constructor() {
    super(
      'Não é possível remover categoria com produtos vinculados.',
      'CATEGORY_HAS_PRODUCTS',
      409,
    )
  }
}

export class CategoryNameConflictError extends DomainError {
  constructor(name: string) {
    super(`Categoria "${name}" já existe.`, 'CATEGORY_NAME_CONFLICT', 409, { name })
  }
}

// --- CRM: Bloqueio de cliente ---

export class CustomerBlockedError extends DomainError {
  constructor() {
    super(
      'Não foi possível completar o agendamento. Entre em contato com o salão.',
      'CUSTOMER_BLOCKED',
      403,
    )
  }
}

export class TenantBlockedError extends DomainError {
  constructor() {
    super(
      'Este negócio está suspenso. Entre em contato com o suporte.',
      'TENANT_BLOCKED',
      403,
    )
  }
}

export class PublicBookingDisabledError extends DomainError {
  constructor() {
    super(
      'Este salão não está aceitando agendamentos online no momento.',
      'PUBLIC_BOOKING_DISABLED',
      403,
    )
  }
}

export class PublicPageDisabledError extends DomainError {
  constructor() {
    super(
      'Esta vitrine não está disponível no momento.',
      'PUBLIC_PAGE_DISABLED',
      403,
    )
  }
}

// --- Financial ---

export class DiscountTypeInUseError extends DomainError {
  constructor() {
    super(
      'Não é possível excluir um tipo de desconto já usado em agendamentos. Arquive-o em vez de excluir.',
      'DISCOUNT_TYPE_IN_USE',
      409,
    )
  }
}

// --- Catalog ---

export class CatalogItemNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Item de catálogo não encontrado: "${id}".`, 'CATALOG_ITEM_NOT_FOUND', 404, { id })
  }
}

// --- Reviews (avaliação pós-atendimento) ---

export class ReviewNotEligibleError extends DomainError {
  constructor() {
    super(
      'Só é possível avaliar um atendimento concluído.',
      'REVIEW_NOT_ELIGIBLE',
      422,
    )
  }
}

export class ReviewAlreadyExistsError extends DomainError {
  constructor() {
    super('Este atendimento já foi avaliado.', 'REVIEW_ALREADY_EXISTS', 409)
  }
}

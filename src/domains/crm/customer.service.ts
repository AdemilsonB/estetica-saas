import type { Customer } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";
import { ConflictError, CustomerNotFoundError } from "@/shared/errors";
import { featureGuard } from "@/domains/billing/feature-guard";

import {
  buildPreviewPhoneVariants,
  normalizeImportedPhone,
} from "@/shared/utils/vcard";

import { customerRepository, type CustomerFilters } from "./customer.repository";
import type {
  CreateCustomerInput,
  ImportCustomerItem,
  UpdateCustomerInput,
} from "./types";

export class CustomerService {
  async list(tenantId: string, filters?: CustomerFilters) {
    return customerRepository.findAll(tenantId, filters);
  }

  async create(tenantId: string, input: CreateCustomerInput) {
    const customerCount = await customerRepository.count(tenantId);
    await featureGuard.assertWithinLimit(tenantId, "customers", customerCount);

    if (input.phone) {
      const existing = await customerRepository.findByPhone(tenantId, input.phone);
      if (existing) {
        throw new ConflictError(
          "Ja existe um cliente com este telefone neste tenant.",
        );
      }
    }

    const customer = await customerRepository.create(tenantId, {
      name: input.name,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
      tags: input.tags,
    });

    eventBus.publish({
      type: "crm.customer.created",
      payload: { tenantId, customer },
    });

    return customer;
  }

  /**
   * Importa contatos externos (ex.: WhatsApp) como clientes completos.
   * Telefones são normalizados sem DDI 55; duplicados (no lote e no banco,
   * em qualquer forma com/sem DDI) são pulados; consentimento nunca é assumido.
   */
  async importCustomers(
    tenantId: string,
    customers: ImportCustomerItem[],
    origin: string,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    const errors: string[] = [];

    // Normaliza e deduplica dentro do lote
    const seenPhones = new Set<string>();
    const normalized: Array<ImportCustomerItem & { phone: string }> = [];
    for (const item of customers) {
      const phone = normalizeImportedPhone(item.phone);
      if (phone.length < 8) {
        errors.push(item.phone);
        continue;
      }
      if (seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      normalized.push({ ...item, phone });
    }

    // Dedup contra o banco casando telefones gravados com ou sem DDI 55
    const variants = buildPreviewPhoneVariants(normalized.map((c) => c.phone));
    const existing = await customerRepository.findByPhones(tenantId, variants);
    const existingPhones = new Set(
      existing.map((c) => c.phone).filter((p): p is string => p !== null),
    );
    const alreadyExists = (phone: string) =>
      existingPhones.has(phone) || existingPhones.has("55" + phone);

    const toCreate = normalized.filter((c) => !alreadyExists(c.phone));
    const skipped = customers.length - toCreate.length - errors.length;

    if (toCreate.length > 0) {
      const customerCount = await customerRepository.count(tenantId);
      await featureGuard.assertWithinLimit(
        tenantId,
        "customers",
        customerCount + toCreate.length - 1,
      );
    }

    let created = 0;
    for (const item of toCreate) {
      try {
        const customer = await customerRepository.create(tenantId, {
          name: item.name,
          phone: item.phone,
          email: item.email,
          notes: item.notes,
          tags: item.tags,
          isVip: item.isVip ?? false,
          birthDate: item.birthDate ? new Date(item.birthDate) : undefined,
          consentGiven: false,
          consentOrigin: origin,
        });
        created++;

        eventBus.publish({
          type: "crm.customer.created",
          payload: { tenantId, customer },
        });
      } catch {
        errors.push(item.phone);
      }
    }

    return { created, skipped, errors };
  }

  async update(tenantId: string, customerId: string, input: UpdateCustomerInput) {
    const customer = await customerRepository.findById(tenantId, customerId);
    if (!customer) {
      throw new CustomerNotFoundError();
    }

    if (input.phone && input.phone !== customer.phone) {
      const existing = await customerRepository.findByPhone(tenantId, input.phone);
      if (existing && existing.id !== customerId) {
        throw new ConflictError(
          "Ja existe um cliente com este telefone neste tenant.",
        );
      }
    }

    const updated = await customerRepository.update(tenantId, customerId, {
      name: input.name,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
      tags: input.tags,
    });

    eventBus.publish({
      type: "crm.customer.updated",
      payload: { tenantId, customer: updated },
    });

    return updated;
  }

  async getProfile(tenantId: string, customerId: string) {
    const profile = await customerRepository.findByIdWithStats(tenantId, customerId);
    if (!profile) throw new CustomerNotFoundError();

    const { _count, ...rest } = profile;
    return {
      ...rest,
      noShowCount: _count.appointments,
    };
  }

  async delete(tenantId: string, customerId: string): Promise<void> {
    const customer = await customerRepository.findById(tenantId, customerId);
    if (!customer) {
      throw new CustomerNotFoundError();
    }
    await customerRepository.softDelete(tenantId, customerId);
    eventBus.publish({
      type: "crm.customer.deleted",
      payload: { tenantId, customerId },
    });
  }

  async restore(tenantId: string, customerId: string): Promise<Customer> {
    const customer = await customerRepository.findDeletedById(tenantId, customerId);
    if (!customer) {
      throw new CustomerNotFoundError();
    }
    const restored = await customerRepository.restore(tenantId, customerId);
    eventBus.publish({
      type: "crm.customer.restored",
      payload: { tenantId, customer: restored },
    });
    return restored;
  }

  async getFavorites(tenantId: string, customerId: string) {
    const customer = await customerRepository.findById(tenantId, customerId);
    if (!customer) throw new CustomerNotFoundError();
    return {
      favoriteServiceIds: customer.favoriteServiceIds,
      favoritePackageIds: customer.favoritePackageIds,
    };
  }

  async toggleFavorite(
    tenantId: string,
    customerId: string,
    kind: "service" | "package",
    itemId: string,
  ): Promise<{ favorited: boolean }> {
    const customer = await customerRepository.findById(tenantId, customerId);
    if (!customer) throw new CustomerNotFoundError();

    const field = kind === "service" ? "favoriteServiceIds" : "favoritePackageIds";
    const current = customer[field];
    const alreadyFavorited = current.includes(itemId);
    const next = alreadyFavorited ? current.filter((id) => id !== itemId) : [...current, itemId];

    await customerRepository.update(tenantId, customerId, { [field]: next });

    eventBus.publish({
      type: "crm.customer.favorite_toggled",
      payload: { tenantId, customerId, kind, itemId, favorited: !alreadyFavorited },
    });

    return { favorited: !alreadyFavorited };
  }
}

export const customerService = new CustomerService();

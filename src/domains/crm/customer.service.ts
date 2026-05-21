import { eventBus } from "@/shared/events/event-bus";
import { ConflictError, NotFoundError } from "@/shared/errors";

import { customerRepository } from "./customer.repository";
import type { CreateCustomerInput, UpdateCustomerInput } from "./types";

export class CustomerService {
  async list(tenantId: string) {
    return customerRepository.findAll(tenantId);
  }

  async create(tenantId: string, input: CreateCustomerInput) {
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

  async update(tenantId: string, customerId: string, input: UpdateCustomerInput) {
    const customer = await customerRepository.findById(tenantId, customerId);
    if (!customer) {
      throw new NotFoundError("Cliente");
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
}

export const customerService = new CustomerService();

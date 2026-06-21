import type { Customer } from "@prisma/client";

import { eventBus } from "@/shared/events/event-bus";
import { ConflictError, CustomerNotFoundError } from "@/shared/errors";

import { customerRepository, type CustomerFilters } from "./customer.repository";
import type { CreateCustomerInput, UpdateCustomerInput } from "./types";

export class CustomerService {
  async list(tenantId: string, filters?: CustomerFilters) {
    return customerRepository.findAll(tenantId, filters);
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
}

export const customerService = new CustomerService();

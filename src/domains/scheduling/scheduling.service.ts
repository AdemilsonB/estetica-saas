import {
  AppointmentStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { eventBus } from "@/shared/events/event-bus";
import {
  AppointmentNotFoundError,
  CustomerNotFoundError,
  ProfessionalNotFoundError,
  ServiceNotFoundError,
} from "@/shared/errors";

import { appointmentRepository, type AppointmentFilters } from "./appointment.repository";
import { availabilityService } from "./availability.service";
import { catalogServiceRepository } from "./service.repository";
import type {
  CreateAppointmentInput,
  CreateServiceInput,
  UpdateAppointmentStatusInput,
  UpdateServiceInput,
} from "./types";

export class SchedulingService {
  async listServices(tenantId: string) {
    return catalogServiceRepository.list(tenantId);
  }

  async createService(tenantId: string, input: CreateServiceInput) {
    return catalogServiceRepository.create(tenantId, {
      name: input.name,
      duration: input.duration,
      price: new Prisma.Decimal(input.price),
      active: input.active,
    });
  }

  async listAppointments(tenantId: string, filters?: AppointmentFilters) {
    return appointmentRepository.findAll(tenantId, filters);
  }

  async createAppointment(
    tenantId: string,
    userId: string,
    input: CreateAppointmentInput,
  ) {
    const service = await catalogServiceRepository.findById(tenantId, input.serviceId);
    if (!service) {
      throw new ServiceNotFoundError();
    }

    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, tenantId },
    });
    if (!customer) {
      throw new CustomerNotFoundError();
    }

    const professional = await prisma.user.findFirst({
      where: { id: input.professionalId, tenantId },
    });
    if (!professional) {
      throw new ProfessionalNotFoundError();
    }

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(startsAt.getTime() + service.duration * 60 * 1000);

    if (!input.allowOverlap) {
      await availabilityService.ensureSlotAvailable(
        tenantId,
        input.professionalId,
        startsAt,
        endsAt,
      );
    }

    const appointment = await appointmentRepository.create(tenantId, {
      customerId: input.customerId,
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      startsAt,
      endsAt,
      notes: input.notes,
      price: new Prisma.Decimal(service.price),
      createdByUserId: userId,
      allowOverlap: input.allowOverlap ?? false,
    });

    const appointmentDetails = await appointmentRepository.findById(
      tenantId,
      appointment.id,
    );
    if (!appointmentDetails) {
      throw new AppointmentNotFoundError();
    }

    eventBus.publish({
      type: "scheduling.appointment.created",
      payload: this.toAppointmentEventPayload(tenantId, appointmentDetails),
    });

    return appointment;
  }

  async updateAppointmentStatus(
    tenantId: string,
    appointmentId: string,
    input: UpdateAppointmentStatusInput,
  ) {
    const current = await appointmentRepository.findById(tenantId, appointmentId);
    if (!current) {
      throw new AppointmentNotFoundError();
    }

    await appointmentRepository.updateStatus(
      tenantId,
      appointmentId,
      input.status,
    );

    const appointment = await appointmentRepository.findById(tenantId, appointmentId);
    if (!appointment) {
      throw new AppointmentNotFoundError();
    }

    const eventType = this.resolveStatusEvent(input.status);
    if (eventType) {
      eventBus.publish({
        type: eventType,
        payload: this.toAppointmentEventPayload(tenantId, appointment),
      });
    }

    return appointment;
  }

  async updateService(tenantId: string, serviceId: string, input: UpdateServiceInput) {
    const existing = await catalogServiceRepository.findById(tenantId, serviceId);
    if (!existing) throw new ServiceNotFoundError();
    return catalogServiceRepository.update(tenantId, serviceId, input);
  }

  async deactivateService(tenantId: string, serviceId: string) {
    const existing = await catalogServiceRepository.findById(tenantId, serviceId);
    if (!existing) throw new ServiceNotFoundError();
    return catalogServiceRepository.deactivate(tenantId, serviceId);
  }

  private resolveStatusEvent(status: AppointmentStatus) {
    switch (status) {
      case AppointmentStatus.CONFIRMED:
        return "scheduling.appointment.confirmed" as const;
      case AppointmentStatus.COMPLETED:
        return "scheduling.appointment.completed" as const;
      case AppointmentStatus.CANCELLED:
        return "scheduling.appointment.cancelled" as const;
      case AppointmentStatus.NO_SHOW:
        return "scheduling.appointment.no_show" as const;
      case AppointmentStatus.SCHEDULED:
        return null;
    }
  }

  private toAppointmentEventPayload(
    tenantId: string,
    appointment: NonNullable<Awaited<ReturnType<typeof appointmentRepository.findById>>>,
  ) {
    return {
      tenantId,
      appointment: {
        id: appointment.id,
        tenantId: appointment.tenantId,
        customerId: appointment.customerId,
        professionalId: appointment.professionalId,
        serviceId: appointment.serviceId,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        status: appointment.status,
        notes: appointment.notes,
        allowOverlap: appointment.allowOverlap,
        price: appointment.price,
        createdByUserId: appointment.createdByUserId,
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt,
      },
      customer: {
        id: appointment.customer.id,
        name: appointment.customer.name,
        phone: appointment.customer.phone,
        email: appointment.customer.email,
      },
      service: {
        id: appointment.service.id,
        name: appointment.service.name,
        duration: appointment.service.duration,
      },
      professional: {
        id: appointment.professional.id,
        name: appointment.professional.name,
        email: appointment.professional.email,
      },
    };
  }
}

export const schedulingService = new SchedulingService();

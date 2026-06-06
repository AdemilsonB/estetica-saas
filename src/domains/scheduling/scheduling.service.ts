import {
  AppointmentStatus,
  AppointmentPaymentStatus,
  PaymentMethod,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { eventBus } from "@/shared/events/event-bus";
import {
  AppointmentNotFoundError,
  AppointmentAlreadyCancelledError,
  CustomerBlockedError,
  CustomerNotFoundError,
  ProfessionalNotFoundError,
  ServiceNotFoundError,
} from "@/shared/errors";
import {
  scheduleAppointmentReminder,
  cancelAppointmentReminder,
} from "@/shared/queue/jobs/appointment-reminder";

import { featureGuard } from "@/domains/billing/feature-guard";
import { commissionRepository } from "@/domains/financial/commission.repository";
import { discountTypeRepository } from "@/domains/financial/discount-type.repository";

import { appointmentRepository, type AppointmentFilters } from "./appointment.repository";
import { availabilityService } from "./availability.service";
import { packageRepository } from "./package.repository";
import { promotionRepository } from "./promotion.repository";
import { catalogServiceRepository } from "./service.repository";
import type {
  CreateAppointmentInput,
  CreatePackageInput,
  CreatePromotionInput,
  CreateServiceInput,
  UpdateAppointmentInput,
  UpdateAppointmentStatusInput,
  UpdatePackageInput,
  UpdatePromotionInput,
  UpdateServiceInput,
} from "./types";

export type CheckoutInput = {
  paymentMethod: PaymentMethod;
  discountTypeId?: string;
  discountValue?: number;
  tipAmount?: number;
};

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
    const appointmentCount = await appointmentRepository.countThisMonth(tenantId);
    await featureGuard.assertWithinLimit(tenantId, "appointments_month", appointmentCount);

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
    if (customer.isBlocked) {
      throw new CustomerBlockedError(customer.name);
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
      payload: {
        ...this.toAppointmentEventPayload(tenantId, appointmentDetails),
        notificationMessage: input.notificationMessage,
      },
    });

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { whatsappEnabled: true },
    });
    if (tenant?.whatsappEnabled) {
      await scheduleAppointmentReminder(tenantId, appointment.id, startsAt);
    }

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
        payload: {
          ...this.toAppointmentEventPayload(tenantId, appointment),
          ...(input.status === AppointmentStatus.CANCELLED
            ? { notificationMessage: input.notificationMessage }
            : {}),
        },
      });
    }

    if (input.status === AppointmentStatus.CANCELLED) {
      await cancelAppointmentReminder(appointmentId);
    }

    return appointment;
  }

  async updateAppointment(
    tenantId: string,
    appointmentId: string,
    input: UpdateAppointmentInput,
  ) {
    const current = await appointmentRepository.findById(tenantId, appointmentId);
    if (!current) throw new AppointmentNotFoundError();

    const nonReschedulable: AppointmentStatus[] = [
      AppointmentStatus.CANCELLED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.NO_SHOW,
    ];
    if (nonReschedulable.includes(current.status)) {
      throw new AppointmentAlreadyCancelledError();
    }

    const newStartsAt = input.startsAt ? new Date(input.startsAt) : current.startsAt;
    const newEndsAt = input.endsAt ? new Date(input.endsAt) : current.endsAt;
    const newProfessionalId = input.professionalId ?? current.professionalId;

    const timeOrProfessionalChanged =
      input.startsAt !== undefined ||
      input.endsAt !== undefined ||
      input.professionalId !== undefined;

    if (timeOrProfessionalChanged) {
      await availabilityService.ensureSlotAvailableExcluding(
        tenantId,
        newProfessionalId,
        newStartsAt,
        newEndsAt,
        appointmentId,
      );
    }

    const updated = await appointmentRepository.update(tenantId, appointmentId, {
      startsAt: input.startsAt !== undefined ? newStartsAt : undefined,
      endsAt: input.endsAt !== undefined ? newEndsAt : undefined,
      professionalId: input.professionalId,
      serviceId: input.serviceId,
    });

    eventBus.publish({
      type: "scheduling.appointment.rescheduled",
      payload: {
        tenantId,
        appointmentId: updated.id,
        customerId: updated.customerId,
        customerName: current.customer.name,
        customerPhone: current.customer.phone,
        serviceName: current.service.name,
        professionalName: updated.professional.name,
        oldStartsAt: current.startsAt,
        newStartsAt: updated.startsAt,
        newEndsAt: updated.endsAt,
        notificationMessage: input.notificationMessage ?? "",
      },
    });

    return updated;
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

  async markPayment(tenantId: string, appointmentId: string, input: CheckoutInput) {
    const appointment = await appointmentRepository.findById(tenantId, appointmentId);
    if (!appointment) throw new AppointmentNotFoundError();

    const grossAmount = Number(appointment.price);

    // Calcular desconto
    let discountAmount = 0;
    if (input.discountTypeId && input.discountValue !== undefined) {
      const discountType = await discountTypeRepository.list(tenantId).then(
        (list) => list.find((d) => d.id === input.discountTypeId),
      );
      if (discountType) {
        discountAmount = discountType.type === "PERCENTAGE"
          ? grossAmount * input.discountValue / 100
          : input.discountValue;
      }
    }

    const subtotal = grossAmount - discountAmount;
    const tipAmount = input.tipAmount ?? 0;

    // Calcular taxa de cartão
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { cardFeeConfig: true },
    });
    const cardFeeConfig = tenant?.cardFeeConfig as Record<string, number> | null;
    const cardFeeRate = (input.paymentMethod === "DEBIT_CARD" || input.paymentMethod === "CREDIT_CARD")
      ? (cardFeeConfig?.[input.paymentMethod] ?? 0)
      : 0;
    const cardFeeAmount = subtotal * cardFeeRate / 100;
    const netAmount = subtotal + tipAmount - cardFeeAmount;

    // Calcular comissão
    const commission = await commissionRepository.findRate(
      tenantId, appointment.serviceId, appointment.professionalId,
    );
    const commissionAmount = commission
      ? netAmount * Number(commission.rate) / 100 + tipAmount
      : 0;

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        paymentStatus: AppointmentPaymentStatus.PAID,
        paymentMethod: input.paymentMethod,
        discountTypeId: input.discountTypeId ?? null,
        discountValue: input.discountValue !== undefined
          ? new Prisma.Decimal(input.discountValue)
          : null,
      },
    });

    eventBus.publish({
      type: "scheduling.appointment.paid",
      payload: {
        tenantId,
        appointmentId,
        serviceId: appointment.serviceId,
        professionalId: appointment.professionalId,
        paymentMethod: input.paymentMethod,
        grossAmount,
        discountAmount,
        discountTypeId: input.discountTypeId ?? null,
        tipAmount,
        cardFeeAmount,
        netAmount,
        commissionAmount,
      },
    });

    return { grossAmount, discountAmount, tipAmount, cardFeeAmount, netAmount, commissionAmount };
  }

  async markCourtesy(tenantId: string, appointmentId: string) {
    const appointment = await appointmentRepository.findById(tenantId, appointmentId);
    if (!appointment) throw new AppointmentNotFoundError();

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { paymentStatus: AppointmentPaymentStatus.COURTESY },
    });

    eventBus.publish({
      type: "scheduling.appointment.courtesy",
      payload: {
        tenantId,
        appointmentId,
        serviceId: appointment.serviceId,
        grossAmount: Number(appointment.price),
      },
    });
  }

  async markDebt(tenantId: string, appointmentId: string) {
    const appointment = await appointmentRepository.findById(tenantId, appointmentId);
    if (!appointment) throw new AppointmentNotFoundError();

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { paymentStatus: AppointmentPaymentStatus.DEBT },
    });
  }

  async listPackages(tenantId: string) {
    return packageRepository.list(tenantId)
  }

  async createPackage(tenantId: string, input: CreatePackageInput) {
    return packageRepository.create(tenantId, {
      name: input.name,
      description: input.description,
      price: input.price,
      serviceIds: input.serviceIds,
      imageUrl: input.imageUrl,
    })
  }

  async updatePackage(tenantId: string, packageId: string, input: UpdatePackageInput) {
    return packageRepository.update(tenantId, packageId, input)
  }

  async deactivatePackage(tenantId: string, packageId: string) {
    return packageRepository.deactivate(tenantId, packageId)
  }

  async listPromotions(tenantId: string) {
    return promotionRepository.list(tenantId)
  }

  async createPromotion(tenantId: string, input: CreatePromotionInput) {
    return promotionRepository.create(tenantId, {
      name: input.name,
      description: input.description,
      discountType: input.discountType as 'PERCENTAGE' | 'FIXED',
      discountValue: input.discountValue,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      imageUrl: input.imageUrl,
      items: input.items,
    })
  }

  async updatePromotion(tenantId: string, promotionId: string, input: UpdatePromotionInput) {
    return promotionRepository.update(tenantId, promotionId, {
      ...input,
      discountType: input.discountType as 'PERCENTAGE' | 'FIXED' | undefined,
    })
  }

  async deactivatePromotion(tenantId: string, promotionId: string) {
    return promotionRepository.deactivate(tenantId, promotionId)
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
        paymentStatus: appointment.paymentStatus,
        paymentMethod: appointment.paymentMethod,
        discountTypeId: appointment.discountTypeId,
        discountValue: appointment.discountValue,
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

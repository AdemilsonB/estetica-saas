import {
  AppointmentStatus,
  AppointmentPaymentStatus,
  PaymentMethod,
  Prisma,
  PriceType,
  AnamneseMode,
  type Appointment,
} from "@prisma/client";

import { prisma } from "@/shared/database/prisma";
import { eventBus } from "@/shared/events/event-bus";
import {
  AppointmentAlreadyPaidError,
  AppointmentNotFoundError,
  AppointmentAlreadyCancelledError,
  CustomerBlockedError,
  CustomerNotFoundError,
  ProfessionalNotFoundError,
  RefundNotAllowedError,
  ServiceNotFoundError,
  SlotUnavailableError,
  ValidationError,
} from "@/shared/errors";
import {
  scheduleAppointmentReminder,
  cancelAppointmentReminder,
} from "@/shared/queue/jobs/appointment-reminder";
import { resolveImageCrop } from "@/shared/utils/image-crop";

import { featureGuard } from "@/domains/billing/feature-guard";
import {
  recordAppointmentCourtesy,
  recordAppointmentPayment,
  recordAppointmentRefund,
} from "@/domains/financial/appointment-revenue";
import { commissionRepository } from "@/domains/financial/commission.repository";
import { discountTypeRepository } from "@/domains/financial/discount-type.repository";

import { appointmentRepository, type AppointmentFilters } from "./appointment.repository";
import { availabilityService } from "./availability.service";
import { schedulingPolicyRepository } from "./scheduling-policy.repository";
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
  baseAmount?: number;
};

export class SchedulingService {
  async listServices(tenantId: string) {
    return catalogServiceRepository.list(tenantId);
  }

  async createService(tenantId: string, input: CreateServiceInput) {
    const serviceCount = await catalogServiceRepository.count(tenantId);
    await featureGuard.assertWithinLimit(tenantId, "services", serviceCount);

    return catalogServiceRepository.create(tenantId, {
      name: input.name,
      duration: input.duration,
      price: new Prisma.Decimal(input.price),
      priceType: input.priceType as PriceType,
      ...(input.priceMin != null && { priceMin: new Prisma.Decimal(input.priceMin) }),
      ...(input.priceMax != null && { priceMax: new Prisma.Decimal(input.priceMax) }),
      description: input.description,
      categoryId: input.categoryId,
      active: input.active,
    });
  }

  async listAppointments(tenantId: string, filters?: AppointmentFilters) {
    return appointmentRepository.findAll(tenantId, filters);
  }

  async getAppointmentCounts(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<{ counts: Record<string, number>; capacity: number }> {
    const [counts, policy] = await Promise.all([
      appointmentRepository.countByDateRange(tenantId, from, to),
      schedulingPolicyRepository.findByTenant(tenantId),
    ])
    const slotInterval = policy?.slotIntervalMinutes ?? 30
    const capacity = Math.round(540 / slotInterval)
    return { counts, capacity }
  }

  async createAppointment(
    tenantId: string,
    userId: string,
    input: CreateAppointmentInput,
    origin: "panel" | "public" = "panel",
  ) {
    const appointmentCount = await appointmentRepository.countThisMonth(tenantId);
    await featureGuard.assertWithinLimit(tenantId, "appointments_month", appointmentCount);

    let duration: number;
    let price: Prisma.Decimal;
    let serviceIdForAppointment: string | undefined = input.serviceId;
    let packageIdForAppointment: string | undefined = input.packageId;

    if (input.packageId) {
      const pkg = await packageRepository.findById(tenantId, input.packageId);
      if (!pkg) throw new ServiceNotFoundError();
      duration = pkg.items.reduce((s: number, i: { service: { duration: number } }) => s + i.service.duration, 0) || 60;
      price = new Prisma.Decimal(pkg.price);
      serviceIdForAppointment = undefined;
    } else {
      const service = await catalogServiceRepository.findById(tenantId, input.serviceId!);
      if (!service) throw new ServiceNotFoundError();
      duration = service.duration;
      if (input.promotionId) {
        const promo = await promotionRepository.findById(tenantId, input.promotionId);
        if (promo) {
          const discountedPrice = promo.discountType === 'PERCENTAGE'
            ? Number(service.price) * (1 - Number(promo.discountValue) / 100)
            : Math.max(0, Number(service.price) - Number(promo.discountValue));
          price = new Prisma.Decimal(discountedPrice.toFixed(2));
        } else {
          price = new Prisma.Decimal(service.price);
        }
      } else {
        price = new Prisma.Decimal(service.price);
      }
      packageIdForAppointment = undefined;
    }

    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, tenantId },
    });
    if (!customer) {
      throw new CustomerNotFoundError();
    }
    if (customer.isBlocked) {
      throw new CustomerBlockedError();
    }

    const professional = await prisma.user.findFirst({
      where: { id: input.professionalId, tenantId },
    });
    if (!professional) {
      throw new ProfessionalNotFoundError();
    }

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);

    // Painel não aplica minAdvanceMinutes/maxAdvanceDays (regra é do fluxo público,
    // que já valida isso antes de chegar aqui) — só impede data passada, com escape
    // hatch explícito (allowPastDate) para lançar atendimento esquecido.
    if (startsAt.getTime() < Date.now() && !input.allowPastDate) {
      throw new ValidationError(
        "Não é possível criar agendamento para uma data/hora no passado.",
        { startsAt: input.startsAt },
      );
    }

    // Check (overlap) + create na mesma transação Serializable — duas requisições
    // concorrentes para o mesmo profissional/horário não podem mais passar ambas
    // pelo check antes de qualquer uma criar (double-booking). Postgres aborta uma
    // delas com P2034 (write conflict) quando detecta a corrida.
    let appointment: Appointment;
    try {
      appointment = await prisma.$transaction(
        async (tx) => {
          if (!input.allowOverlap) {
            await availabilityService.ensureSlotAvailable(
              tenantId,
              input.professionalId,
              startsAt,
              endsAt,
              tx,
            );
          }

          return appointmentRepository.create(
            tenantId,
            {
              customerId: input.customerId,
              professionalId: input.professionalId,
              serviceId: serviceIdForAppointment,
              packageId: packageIdForAppointment,
              promotionId: input.promotionId,
              startsAt,
              endsAt,
              notes: input.notes,
              price,
              createdByUserId: userId,
              allowOverlap: input.allowOverlap ?? false,
            },
            tx,
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new SlotUnavailableError();
      }
      throw error;
    }

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
        origin,
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

    const terminalStatuses: AppointmentStatus[] = [
      AppointmentStatus.CANCELLED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.NO_SHOW,
    ];
    if (terminalStatuses.includes(current.status)) {
      throw new AppointmentAlreadyCancelledError();
    }

    await appointmentRepository.updateStatus(
      tenantId,
      appointmentId,
      input.status,
      input.confirmedPrice,
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
          ...([AppointmentStatus.CANCELLED, AppointmentStatus.CONFIRMED] as AppointmentStatus[]).includes(input.status)
            ? { notificationMessage: input.notificationMessage }
            : {},
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
        serviceName: current.service?.name ?? current.package?.name ?? current.promotion?.name ?? "",
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
    const crop = resolveImageCrop(input.imageUrl !== undefined, {
      x: input.imageCropX,
      y: input.imageCropY,
      zoom: input.imageCropZoom,
    })
    return catalogServiceRepository.update(tenantId, serviceId, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.duration !== undefined && { duration: input.duration }),
      ...(input.price !== undefined && { price: new Prisma.Decimal(input.price) }),
      ...(input.priceType !== undefined && { priceType: input.priceType as PriceType }),
      ...(input.priceMin !== undefined && { priceMin: input.priceMin != null ? new Prisma.Decimal(input.priceMin) : null }),
      ...(input.priceMax !== undefined && { priceMax: input.priceMax != null ? new Prisma.Decimal(input.priceMax) : null }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      ...(crop.x !== undefined && { imageCropX: crop.x }),
      ...(crop.y !== undefined && { imageCropY: crop.y }),
      ...(crop.zoom !== undefined && { imageCropZoom: crop.zoom }),
      ...(input.anamneseMode !== undefined && { anamneseMode: input.anamneseMode as AnamneseMode }),
      ...(input.anamneseBlocks !== undefined && { anamneseBlocks: input.anamneseBlocks }),
      ...(input.anamneseValidityDays !== undefined && { anamneseValidityDays: input.anamneseValidityDays }),
    });
  }

  async deactivateService(tenantId: string, serviceId: string) {
    const existing = await catalogServiceRepository.findById(tenantId, serviceId);
    if (!existing) throw new ServiceNotFoundError();
    return catalogServiceRepository.deactivate(tenantId, serviceId);
  }

  async markPayment(tenantId: string, appointmentId: string, input: CheckoutInput) {
    const appointment = await appointmentRepository.findById(tenantId, appointmentId);
    if (!appointment) throw new AppointmentNotFoundError();

    if (appointment.paymentStatus === AppointmentPaymentStatus.PAID) {
      throw new AppointmentAlreadyPaidError();
    }

    const grossAmount = input.baseAmount !== undefined
      ? input.baseAmount
      : appointment.confirmedPrice !== null
        ? Number(appointment.confirmedPrice)
        : Number(appointment.price);

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
    const commission = appointment.serviceId
      ? await commissionRepository.findRate(
          tenantId, appointment.serviceId, appointment.professionalId,
        )
      : null;
    const commissionAmount = commission
      ? netAmount * Number(commission.rate) / 100 + tipAmount
      : 0;

    // Atômico: marcar como pago E registrar a receita na mesma transação.
    // Se o registro financeiro falhar, o agendamento NÃO fica pago (sem perda silenciosa de receita).
    await prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({
        where: { id: appointmentId, tenantId },
        data: {
          paymentStatus: AppointmentPaymentStatus.PAID,
          paymentMethod: input.paymentMethod,
          discountTypeId: input.discountTypeId ?? null,
          discountValue: input.discountValue !== undefined
            ? new Prisma.Decimal(input.discountValue)
            : null,
          ...(input.baseAmount !== undefined && {
            confirmedPrice: new Prisma.Decimal(input.baseAmount),
          }),
        },
      });

      await recordAppointmentPayment(tx, tenantId, {
        appointmentId,
        serviceName: appointment.service?.name ?? appointment.package?.name ?? appointment.promotion?.name ?? null,
        customerName: appointment.customer?.name ?? null,
        paymentMethod: input.paymentMethod,
        grossAmount,
        discountAmount,
        tipAmount,
        cardFeeAmount,
        netAmount,
        commissionAmount,
        professionalId: appointment.professionalId,
      });
    });

    return { grossAmount, discountAmount, tipAmount, cardFeeAmount, netAmount, commissionAmount };
  }

  async markCourtesy(tenantId: string, appointmentId: string) {
    const appointment = await appointmentRepository.findById(tenantId, appointmentId);
    if (!appointment) throw new AppointmentNotFoundError();

    await prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({
        where: { id: appointmentId, tenantId },
        data: { paymentStatus: AppointmentPaymentStatus.COURTESY },
      });

      await recordAppointmentCourtesy(tx, tenantId, {
        appointmentId,
        grossAmount: Number(appointment.price),
      });
    });
  }

  async markDebt(tenantId: string, appointmentId: string) {
    const appointment = await appointmentRepository.findById(tenantId, appointmentId);
    if (!appointment) throw new AppointmentNotFoundError();

    await prisma.appointment.updateMany({
      where: { id: appointmentId, tenantId },
      data: { paymentStatus: AppointmentPaymentStatus.DEBT },
    });
  }

  async refundPayment(tenantId: string, appointmentId: string) {
    const appointment = await appointmentRepository.findById(tenantId, appointmentId);
    if (!appointment) throw new AppointmentNotFoundError();

    if (appointment.status !== AppointmentStatus.CANCELLED) {
      throw new RefundNotAllowedError("Só é possível estornar agendamentos cancelados.");
    }
    if (appointment.paymentStatus !== AppointmentPaymentStatus.PAID) {
      throw new RefundNotAllowedError("Este agendamento não está marcado como pago.");
    }

    // Atômico: marcar como estornado E registrar o estorno na mesma transação.
    await prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({
        where: { id: appointmentId, tenantId },
        data: { paymentStatus: AppointmentPaymentStatus.REFUNDED },
      });

      await recordAppointmentRefund(tx, tenantId, {
        appointmentId,
        serviceName: appointment.service?.name ?? appointment.package?.name ?? appointment.promotion?.name ?? null,
        customerName: appointment.customer?.name ?? null,
      });
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
    const crop = resolveImageCrop(input.imageUrl !== undefined, {
      x: input.imageCropX,
      y: input.imageCropY,
      zoom: input.imageCropZoom,
    })
    return packageRepository.update(tenantId, packageId, {
      ...input,
      imageCropX: crop.x,
      imageCropY: crop.y,
      imageCropZoom: crop.zoom,
    })
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
    const crop = resolveImageCrop(input.imageUrl !== undefined, {
      x: input.imageCropX,
      y: input.imageCropY,
      zoom: input.imageCropZoom,
    })
    return promotionRepository.update(tenantId, promotionId, {
      ...input,
      discountType: input.discountType as 'PERCENTAGE' | 'FIXED' | undefined,
      imageCropX: crop.x,
      imageCropY: crop.y,
      imageCropZoom: crop.zoom,
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
        packageId: appointment.packageId,
        promotionId: appointment.promotionId,
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
        confirmedPrice: appointment.confirmedPrice,
        createdByUserId: appointment.createdByUserId,
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt,
        anamneseId: appointment.anamneseId ?? null,
      },
      customer: {
        id: appointment.customer.id,
        name: appointment.customer.name,
        phone: appointment.customer.phone,
        email: appointment.customer.email,
      },
      service: {
        id: appointment.service?.id ?? "",
        name: appointment.service?.name ?? appointment.package?.name ?? appointment.promotion?.name ?? "",
        duration: appointment.service?.duration ?? (appointment.package?.items?.reduce((s: number, i: { service: { duration: number } }) => s + i.service.duration, 0) ?? 0),
      },
      professional: {
        id: appointment.professional.id,
        name: appointment.professional.name,
        email: appointment.professional.email,
      },
    };
  }

  async emitAppointmentCreated(
    tenantId: string,
    appointmentId: string,
    origin: "panel" | "public" = "public",
  ): Promise<void> {
    const appointmentDetails = await appointmentRepository.findById(tenantId, appointmentId);
    if (!appointmentDetails) {
      throw new AppointmentNotFoundError();
    }
    eventBus.publish({
      type: "scheduling.appointment.created",
      payload: {
        ...this.toAppointmentEventPayload(tenantId, appointmentDetails),
        origin,
      },
    });
  }
}

export const schedulingService = new SchedulingService();

import type { Appointment, Customer, NotificationLog, Transaction } from "@prisma/client";

type BrandingConfigUpdate = {
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  fontFamily: string
  borderRadius: string
  colorScheme: string
}

type AppointmentEventPayload = {
  tenantId: string;
  appointment: Appointment;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  service: {
    id: string;
    name: string;
    duration: number;
  };
  professional: {
    id: string;
    name: string;
    email: string;
  };
  notificationMessage?: string;
};

type RescheduledEventPayload = {
  tenantId: string;
  appointmentId: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  professionalName: string;
  oldStartsAt: Date;
  newStartsAt: Date;
  newEndsAt: Date;
  notificationMessage: string;
};

export type DomainEvent =
  | {
      type: "crm.customer.created";
      payload: { tenantId: string; customer: Customer };
    }
  | {
      type: "crm.customer.updated";
      payload: { tenantId: string; customer: Customer };
    }
  | {
      type: "scheduling.appointment.created";
      payload: AppointmentEventPayload;
    }
  | {
      type: "scheduling.appointment.confirmed";
      payload: AppointmentEventPayload;
    }
  | {
      type: "scheduling.appointment.completed";
      payload: AppointmentEventPayload;
    }
  | {
      type: "scheduling.appointment.cancelled";
      payload: AppointmentEventPayload;
    }
  | {
      type: "scheduling.appointment.no_show";
      payload: AppointmentEventPayload;
    }
  | {
      type: "scheduling.appointment.rescheduled";
      payload: RescheduledEventPayload;
    }
  | {
      type: "financial.transaction.created";
      payload: { tenantId: string; transaction: Transaction };
    }
  | {
      type: "notifications.notification.logged";
      payload: { tenantId: string; notification: NotificationLog };
    }
  | {
      type: "billing.trial.expired";
      payload: { tenantId: string };
    }
  | {
      type: "billing.subscription.upgraded";
      payload: {
        tenantId: string;
        fromPlan: import("@prisma/client").PlanName | undefined;
        toPlan: import("@prisma/client").PlanName;
      };
    }
  | {
      type: "tenant.branding.updated";
      payload: { tenantId: string; changes: Partial<BrandingConfigUpdate> };
    }
  | {
      type: "scheduling.appointment.paid";
      payload: {
        tenantId: string;
        appointmentId: string;
        serviceId: string;
        professionalId: string;
        paymentMethod: import("@prisma/client").PaymentMethod;
        grossAmount: number;
        discountAmount: number;
        discountTypeId: string | null;
        tipAmount: number;
        cardFeeAmount: number;
        netAmount: number;
        commissionAmount: number;
      };
    }
  | {
      type: "scheduling.appointment.courtesy";
      payload: {
        tenantId: string;
        appointmentId: string;
        serviceId: string;
        grossAmount: number;
      };
    }
  | {
      type: 'product.sold'
      payload: {
        tenantId: string
        productId: string
        quantity: number
        totalAmount: number
        customerId?: string
      }
    }
  | {
      type: 'stock.purchased'
      payload: {
        tenantId: string
        productId: string
        quantity: number
        totalAmount: number
      }
    };

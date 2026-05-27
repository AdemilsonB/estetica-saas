import type { Appointment, Customer, NotificationLog, Transaction } from "@prisma/client";

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
    };

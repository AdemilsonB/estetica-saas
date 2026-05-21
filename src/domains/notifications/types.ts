import { NotificationChannel, NotificationStatus } from "@prisma/client";

export type NotificationDraft = {
  tenantId: string;
  appointmentId?: string;
  customerId?: string;
  channel: NotificationChannel;
  template: string;
  recipient: string;
  provider: string;
  payload: Record<string, unknown>;
};

export type NotificationDeliveryResult = {
  status: NotificationStatus;
  errorMessage?: string;
};

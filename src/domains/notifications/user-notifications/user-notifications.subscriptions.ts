import { eventBus } from "@/shared/events/event-bus";
import { userNotificationService } from "./user-notification.service";

let registered = false;

export function registerUserNotificationSubscriptions(): void {
  if (registered) return;
  registered = true;

  eventBus.subscribe("scheduling.appointment.created", async (payload) => {
    try {
      await userNotificationService.notifyAppointment(payload, "created");
    } catch (err) {
      console.error("[user-notifications] created:", err);
    }
  });

  eventBus.subscribe("scheduling.appointment.cancelled", async (payload) => {
    try {
      await userNotificationService.notifyAppointment(payload, "cancelled");
    } catch (err) {
      console.error("[user-notifications] cancelled:", err);
    }
  });

  eventBus.subscribe("crm.customer.created", async (payload) => {
    try {
      await userNotificationService.notifyCustomerCreated({
        tenantId: payload.tenantId,
        customer: { id: payload.customer.id, name: payload.customer.name },
      });
    } catch (err) {
      console.error("[user-notifications] customer.created:", err);
    }
  });
}

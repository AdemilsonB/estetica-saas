import { eventBus } from "@/shared/events/event-bus";
import { teamNotificationDispatcher } from "./team-notification-dispatcher.service";

let registered = false;

export function registerUserNotificationSubscriptions(): void {
  if (registered) return;
  registered = true;

  eventBus.subscribe("scheduling.appointment.created", async (payload) => {
    try {
      await teamNotificationDispatcher.dispatchAppointmentEvent("appointment_created", payload);
    } catch (err) {
      console.error("[team-notifications] created:", err);
    }
  });

  eventBus.subscribe("scheduling.appointment.cancelled", async (payload) => {
    try {
      await teamNotificationDispatcher.dispatchAppointmentEvent("appointment_cancelled", payload);
    } catch (err) {
      console.error("[team-notifications] cancelled:", err);
    }
  });

  eventBus.subscribe("scheduling.appointment.no_show", async (payload) => {
    try {
      await teamNotificationDispatcher.dispatchAppointmentEvent("appointment_no_show", payload);
    } catch (err) {
      console.error("[team-notifications] no_show:", err);
    }
  });

  eventBus.subscribe("scheduling.appointment.rescheduled", async (payload) => {
    try {
      await teamNotificationDispatcher.dispatchAppointmentRescheduled({
        tenantId: payload.tenantId,
        appointmentId: payload.appointmentId,
        customerId: payload.customerId,
        customerName: payload.customerName,
        newStartsAt: payload.newStartsAt,
      });
    } catch (err) {
      console.error("[team-notifications] rescheduled:", err);
    }
  });

  eventBus.subscribe("crm.customer.created", async (payload) => {
    try {
      await teamNotificationDispatcher.dispatchCustomerCreated({
        tenantId: payload.tenantId,
        customer: { id: payload.customer.id, name: payload.customer.name },
      });
    } catch (err) {
      console.error("[team-notifications] customer.created:", err);
    }
  });
}

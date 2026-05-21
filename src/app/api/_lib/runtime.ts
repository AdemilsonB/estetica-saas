import { registerNotificationSubscriptions } from "@/domains/notifications/subscriptions";

let initialized = false;

export function initializeDomainRuntime() {
  if (initialized) {
    return;
  }

  registerNotificationSubscriptions();
  initialized = true;
}

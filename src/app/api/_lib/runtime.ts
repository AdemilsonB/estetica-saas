import { registerFinancialSubscriptions } from "@/domains/financial/subscriptions";
import { registerNotificationSubscriptions } from "@/domains/notifications/subscriptions";

let initialized = false;

export function initializeDomainRuntime() {
  if (initialized) {
    return;
  }

  registerFinancialSubscriptions();
  registerNotificationSubscriptions();
  initialized = true;
}

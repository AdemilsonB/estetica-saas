import type { PgBoss } from "pg-boss";

import { billingService } from "./billing.service";

export const BILLING_EXPIRE_SWEEP_JOB = "billing:expire-sweep";

export function registerBillingJobs(boss: PgBoss) {
  void boss.schedule(BILLING_EXPIRE_SWEEP_JOB, "0 5 * * *", {});
  void boss.work(BILLING_EXPIRE_SWEEP_JOB, async () => {
    const startedAt = Date.now();
    try {
      const { expiredTrials, expiredActive } = await billingService.runExpireSweep();
      console.info(
        `[billing:expire-sweep] concluído em ${Date.now() - startedAt}ms — trials expirados: ${expiredTrials}, períodos expirados: ${expiredActive}`,
      );
    } catch (err) {
      console.error("[billing:expire-sweep] falhou:", err);
      throw err;
    }
  });
}

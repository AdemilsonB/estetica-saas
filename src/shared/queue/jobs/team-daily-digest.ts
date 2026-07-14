import { prisma } from "@/shared/database/prisma";
import { getEmailProvider } from "@/domains/notifications/providers/email.provider";
import { userNotificationRepository } from "@/domains/notifications/user-notifications/user-notification.repository";
import { tenantNotificationSettingRepository } from "@/domains/notifications/user-notifications/tenant-notification-setting.repository";
import { userNotificationPreferenceRepository } from "@/domains/notifications/user-notifications/user-notification-preference.repository";
import { resolveDelivery } from "@/domains/notifications/user-notifications/notification-channel-resolver";

export const TEAM_DAILY_DIGEST_JOB = "team-daily-digest";

// Eventos que já têm seu próprio resumo periódico — não entram de novo no
// consolidado anti-fadiga do modo digest (evitaria duplicar conteúdo).
const DIGEST_EXCLUDED_TYPES = new Set(["daily_digest", "birthday_digest"]);

export async function handleTeamDailyDigest(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, timezone: true } });

  for (const tenant of tenants) {
    // Só processa o tenant quando são 08h no horário local dele — o cron
    // roda a cada hora e cada tenant "cai" na sua janela certa (mesma
    // técnica de src/shared/queue/jobs/daily-status.ts).
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tenant.timezone }).format(new Date()),
      10,
    );
    if (localHour !== 8) continue;

    const users = await userNotificationRepository.findAllForDigest(tenant.id);
    if (users.length === 0) continue;

    const [dailySetting, overrides] = await Promise.all([
      tenantNotificationSettingRepository.findByTenant(tenant.id, "daily_digest"),
      userNotificationPreferenceRepository.findEmailOverridesForUsers(tenant.id, users.map((u) => u.id), "daily_digest"),
    ]);

    for (const user of users) {
      // (a) Resumo do dia — evento próprio, opt-in igual aos demais.
      const dailyDelivery = resolveDelivery({
        eventType: "daily_digest",
        tenantSetting: dailySetting ? { enabled: dailySetting.enabled, defaultChannels: dailySetting.defaultChannels } : null,
        emailOverrideEnabled: overrides.get(user.id) ?? null,
        prefs: { deliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null },
        now: new Date(),
        tz: tenant.timezone,
      });
      if (dailyDelivery.eventEnabled && dailyDelivery.email) {
        const todayCount = await userNotificationRepository.countTodayAppointmentsFor(tenant.id, user.id, tenant.timezone);
        try {
          await getEmailProvider().send({
            to: user.email,
            subject: "Resumo do seu dia",
            html: `<p>Você tem ${todayCount} agendamento(s) hoje em ${tenant.name}.</p>`,
          });
        } catch (err) {
          console.error(`[team-daily-digest] falha no resumo diário de ${user.email}:`, err);
        }
      }

      // (b) Modo digest (anti-fadiga) — consolida os eventos do dia num único e-mail.
      if (user.notificationDeliveryMode === "digest") {
        const items = await userNotificationRepository.findTodayForDigest(tenant.id, user.id, tenant.timezone);
        const relevant = items.filter((i) => !DIGEST_EXCLUDED_TYPES.has(i.type));
        if (relevant.length === 0) continue;

        const counts = new Map<string, number>();
        for (const i of relevant) counts.set(i.type, (counts.get(i.type) ?? 0) + 1);
        const summary = Array.from(counts.entries()).map(([type, n]) => `${n}x ${type}`).join(", ");

        try {
          await getEmailProvider().send({
            to: user.email,
            subject: "Seu resumo de notificações de hoje",
            html: `<p>${summary}</p>`,
          });
        } catch (err) {
          console.error(`[team-daily-digest] falha no digest de ${user.email}:`, err);
        }
      }
    }
  }
}

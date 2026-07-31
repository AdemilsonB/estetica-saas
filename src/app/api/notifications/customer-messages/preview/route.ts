import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { customerMessageBlockedReason } from "@/domains/notifications/customer-messages/customer-message-delivery";
import { customerMessageService } from "@/domains/notifications/customer-messages/customer-message.service";
import { customerMessageSettingService } from "@/domains/notifications/customer-messages/customer-message-setting.service";
import { customerMessagePreviewSchema } from "@/domains/notifications/customer-messages/schemas";
import type { CustomerMessageChannel } from "@/domains/notifications/customer-messages/types";
import { getSessionContext } from "@/shared/auth/session";
import { prisma } from "@/shared/database/prisma";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

/**
 * Prévia do que o cliente vai receber, para o <CustomerMessageToggle>.
 *
 * NÃO exige permissão de configuração (precedente ADR-016): é leitura de apoio de
 * qualquer colaborador que agenda. O isolamento vem de TODA busca filtrar o
 * tenantId da sessão.
 */
export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    const input = await validateInput(request, customerMessagePreviewSchema);
    const tenantId = session.tenantId;

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        name: true,
        slug: true,
        timezone: true,
        phone: true,
        address: true,
        whatsappEnabled: true,
        evolutionConnected: true,
        evolutionStatus: true,
      },
    });
    if (!tenant) {
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    const agendamento = input.appointmentId
      ? await prisma.appointment.findFirst({
          where: { id: input.appointmentId, tenantId },
          include: {
            customer: { select: { id: true, name: true, phone: true, email: true } },
            service: { select: { name: true, duration: true } },
            package: { select: { name: true } },
            promotion: { select: { name: true } },
            professional: { select: { name: true } },
          },
        })
      : null;

    const cliente =
      agendamento?.customer ??
      (input.customerId
        ? await prisma.customer.findFirst({
            where: { id: input.customerId, tenantId },
            select: { id: true, name: true, phone: true, email: true },
          })
        : null);

    if (!cliente) {
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    const servico =
      agendamento?.service?.name ??
      agendamento?.package?.name ??
      agendamento?.promotion?.name ??
      (input.serviceId
        ? (
            await prisma.service.findFirst({
              where: { id: input.serviceId, tenantId },
              select: { name: true },
            })
          )?.name
        : undefined);

    const profissional =
      agendamento?.professional?.name ??
      (input.professionalId
        ? (
            await prisma.user.findFirst({
              where: { id: input.professionalId, tenantId },
              select: { name: true },
            })
          )?.name
        : undefined);

    const quando =
      agendamento?.startsAt ?? (input.startsAt ? new Date(input.startsAt) : undefined);

    const padrao = await customerMessageSettingService.resolve(tenantId, input.event);

    // Regra de origem da spec §6.4, espelhada aqui para o toggle mostrar o MESMO
    // padrão que o backend vai aplicar. Se divergir, o profissional vê "ligado" e o
    // cliente não recebe nada — pior do que não ter prévia nenhuma.
    const confirmacaoValida =
      input.event !== "appointment_confirmed" || agendamento?.origin === "PUBLIC";
    const defaultEnabled = padrao.enabled && confirmacaoValida;

    const channels = padrao.channels;
    const primaryChannel: CustomerMessageChannel = channels.includes("WHATSAPP")
      ? "WHATSAPP"
      : (channels[0] ?? "WHATSAPP");

    const renderizado = await customerMessageService.render(
      tenantId,
      input.event,
      primaryChannel,
      {
        customerName: cliente.name,
        serviceName: servico,
        professionalName: profissional,
        startsAt: quando,
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          timezone: tenant.timezone,
          phone: tenant.phone,
          address: tenant.address,
        },
      },
    );

    const blockedReason = await customerMessageBlockedReason({
      tenantId,
      channels,
      cliente,
      tenant,
    });

    return Response.json({
      defaultEnabled,
      channels,
      primaryChannel,
      preview: renderizado.text,
      blockedReason,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

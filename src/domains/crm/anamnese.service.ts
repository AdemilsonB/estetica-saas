import { NotificationChannel } from "@prisma/client";

import { CustomerNotFoundError, NotFoundError } from "@/shared/errors";
import {
  anamneseTemplateRepository,
  parseFields,
  type AnamneseTemplateRepository,
} from "./anamnese-template.repository";
import {
  customerAnamneseRepository,
  type CustomerAnamneseRepository,
} from "./customer-anamnese.repository";
import { customerRepository, type CustomerRepository } from "./customer.repository";
import { notificationService } from "@/domains/notifications/notification.service";
import type { NotificationDraft } from "@/domains/notifications/types";
import type { AnamneseData, UpdateAnamneseTemplateInput } from "./types";

type NotifyFn = (draft: NotificationDraft) => Promise<unknown>;

export class AnamneseService {
  constructor(
    private readonly templateRepo: AnamneseTemplateRepository,
    private readonly anamneseRepo: CustomerAnamneseRepository,
    private readonly customerRepo: CustomerRepository,
    private readonly notify: NotifyFn,
    private readonly appUrl: string,
  ) {}

  async getTemplate(tenantId: string) {
    return this.templateRepo.findOrCreate(tenantId);
  }

  async updateTemplate(tenantId: string, input: UpdateAnamneseTemplateInput) {
    return this.templateRepo.update(tenantId, input);
  }

  async getAnamnese(tenantId: string, customerId: string) {
    return this.anamneseRepo.findByCustomer(tenantId, customerId);
  }

  async saveAnamnese(tenantId: string, customerId: string, data: AnamneseData) {
    return this.anamneseRepo.save(tenantId, customerId, data, "professional");
  }

  async sendLink(tenantId: string, customerId: string, message: string) {
    const customer = await this.customerRepo.findById(tenantId, customerId);
    if (!customer) throw new CustomerNotFoundError();
    if (!customer.phone) throw new NotFoundError("Telefone do cliente");

    let anamnese = await this.anamneseRepo.findByCustomer(tenantId, customerId);
    if (!anamnese) {
      anamnese = await this.anamneseRepo.save(tenantId, customerId, {}, "professional");
    }

    const link = `${this.appUrl}/anamnese/${anamnese.publicToken}`;
    const composedMessage = message
      .replace("{nome}", customer.name)
      .replace("{link}", link);

    await this.notify({
      tenantId,
      customerId,
      channel: NotificationChannel.WHATSAPP,
      template: "anamnese-link",
      recipient: customer.phone,
      provider: "twilio",
      payload: { message: composedMessage },
    });

    return { publicToken: anamnese.publicToken, link };
  }

  async getPublicAnamnese(publicToken: string) {
    const anamnese = await this.anamneseRepo.findByPublicToken(publicToken);
    if (!anamnese) throw new NotFoundError("Ficha de anamnese");

    const customerData = anamnese.customer as { tenantId: string; name: string };
    const template = await this.templateRepo.findOrCreate(customerData.tenantId);

    return {
      fields: parseFields(template.fields),
      data: anamnese.data,
      filledAt: anamnese.filledAt,
      customerName: customerData.name,
    };
  }

  async submitPublic(publicToken: string, data: AnamneseData) {
    const anamnese = await this.anamneseRepo.findByPublicToken(publicToken);
    if (!anamnese) throw new NotFoundError("Ficha de anamnese");

    const tenantId = (anamnese.customer as { tenantId: string }).tenantId;
    return this.anamneseRepo.save(tenantId, anamnese.customerId, data, "client");
  }
}

export const anamneseService = new AnamneseService(
  anamneseTemplateRepository,
  customerAnamneseRepository,
  customerRepository,
  (draft) => notificationService.logAndDispatch(draft),
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
);

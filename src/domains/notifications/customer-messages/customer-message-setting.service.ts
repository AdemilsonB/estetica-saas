import type { CustomerMessageSetting } from "@prisma/client";

import { CUSTOMER_MESSAGE_CATALOG, getCatalogEntry } from "./customer-message-catalog";
import { customerMessageSettingRepository } from "./customer-message-setting.repository";
import type { UpdateCustomerMessageSettingInput } from "./schemas";
import type {
  CustomerMessageCatalogEntry,
  CustomerMessageChannel,
  CustomerMessageEventKey,
  CustomerMessageNature,
} from "./types";

export type ResolvedCustomerMessageSetting = {
  event: CustomerMessageEventKey;
  label: string;
  description: string;
  nature: CustomerMessageNature;
  enabled: boolean;
  channels: CustomerMessageChannel[];
  /** true = o tenant mudou este evento; false = está no padrão do sistema. */
  isCustom: boolean;
};

function combinar(
  entrada: CustomerMessageCatalogEntry,
  registro: CustomerMessageSetting | null | undefined,
): ResolvedCustomerMessageSetting {
  return {
    event: entrada.event,
    label: entrada.label,
    description: entrada.description,
    nature: entrada.nature,
    enabled: registro ? registro.enabled : entrada.defaultEnabled,
    channels: registro
      ? (registro.channels as CustomerMessageChannel[])
      : entrada.defaultChannels,
    isCustom: Boolean(registro),
  };
}

export class CustomerMessageSettingService {
  async resolve(
    tenantId: string,
    event: CustomerMessageEventKey,
  ): Promise<ResolvedCustomerMessageSetting> {
    const registro = await customerMessageSettingRepository.findByEvent(tenantId, event);
    return combinar(getCatalogEntry(event), registro);
  }

  /** Uma query só: o banco costuma ter zero ou poucas linhas por tenant. */
  async resolveAll(tenantId: string): Promise<ResolvedCustomerMessageSetting[]> {
    const registros = await customerMessageSettingRepository.listByTenant(tenantId);
    const porEvento = new Map(registros.map((r) => [r.event as CustomerMessageEventKey, r]));
    return CUSTOMER_MESSAGE_CATALOG.map((entrada) =>
      combinar(entrada, porEvento.get(entrada.event)),
    );
  }

  /**
   * A autoridade sobre "envia ou não". O override vem da ação (`notify` na rota) e vale
   * SÓ para aquela ação — nunca altera o padrão do tenant. `undefined` significa
   * "não opinei", e aí manda o padrão do negócio.
   */
  async shouldNotify(
    tenantId: string,
    event: CustomerMessageEventKey,
    override?: boolean,
  ): Promise<boolean> {
    if (override !== undefined) return override;
    return (await this.resolve(tenantId, event)).enabled;
  }

  async save(
    tenantId: string,
    input: UpdateCustomerMessageSettingInput,
  ): Promise<ResolvedCustomerMessageSetting> {
    const registro = await customerMessageSettingRepository.upsert(tenantId, {
      event: input.event,
      enabled: input.enabled,
      channels: input.channels,
    });
    return combinar(getCatalogEntry(input.event), registro);
  }
}

export const customerMessageSettingService = new CustomerMessageSettingService();

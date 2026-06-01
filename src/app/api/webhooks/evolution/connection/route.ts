import { prisma } from "@/shared/database/prisma";

const STATE_MAP: Record<string, string> = {
  open:       "CONNECTED",
  connecting: "CONNECTING",
  close:      "DISCONNECTED",
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || body.event !== "connection.update") {
      return new Response(null, { status: 200 });
    }

    const instanceName: string = body.instance ?? body.data?.instance ?? "";
    const rawState: string = body.data?.state ?? "close";
    const newStatus = STATE_MAP[rawState] ?? "DISCONNECTED";

    if (!instanceName) {
      return new Response(null, { status: 200 });
    }

    const updateData: {
      evolutionStatus: string;
      evolutionConnected: boolean;
      evolutionConnectedAt?: Date | null;
      evolutionPhone?: string | null;
    } = {
      evolutionStatus: newStatus,
      evolutionConnected: newStatus === "CONNECTED",
    };

    if (newStatus === "CONNECTED") {
      updateData.evolutionConnectedAt = new Date();
      // Capturar número se disponível no evento
      const rawPhone: string | undefined = body.data?.wuid;
      if (rawPhone) {
        const digits = rawPhone.replace("@s.whatsapp.net", "");
        updateData.evolutionPhone = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
      }
    } else if (newStatus === "DISCONNECTED") {
      updateData.evolutionConnectedAt = null;
    }

    // instanceName = tenantId (configurado em connect/route.ts)
    await prisma.tenant.updateMany({
      where: { evolutionInstanceId: instanceName },
      data: updateData,
    });

    return new Response(null, { status: 200 });
  } catch {
    // Nunca retornar 5xx para webhook — Evolution faria retry indefinido
    return new Response(null, { status: 200 });
  }
}

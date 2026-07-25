import { POST as handleConnection } from "./connection/route";
import { POST as handleMessages } from "./messages/route";

// A Evolution API guarda UM único webhook por instância, então todos os eventos
// chegam nesta URL (registrada inline no /instance/create) e são despachados pelo
// campo `event` do payload. As rotas /connection e /messages continuam existindo
// para instâncias antigas registradas com as URLs separadas.
export async function POST(request: Request): Promise<Response> {
  const body = await request
    .clone()
    .json()
    .catch(() => null);

  const event: string = typeof body?.event === "string" ? body.event : "";

  if (event === "connection.update") return handleConnection(request);
  if (event === "messages.upsert") return handleMessages(request);

  // Evento não tratado — 200 para a Evolution não fazer retry indefinido
  return new Response(null, { status: 200 });
}

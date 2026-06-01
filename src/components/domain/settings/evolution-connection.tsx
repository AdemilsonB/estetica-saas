"use client";

import { useState, useEffect } from "react";
import { Smartphone, Loader2, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useEvolutionStatus,
  useEvolutionConnect,
  useEvolutionDisconnect,
} from "@/hooks/settings/use-evolution-status";

type Props = {
  onImportContacts: () => void;
};

export function EvolutionConnection({ onImportContacts }: Props) {
  const [qrCode, setQrCode] = useState<string | null>(null);

  const { data: statusData, isLoading } = useEvolutionStatus({
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "CONNECTING" ? 3000 : false;
    },
  });

  const { mutate: connect, isPending: isConnecting } = useEvolutionConnect();
  const { mutate: disconnect, isPending: isDisconnecting } = useEvolutionDisconnect();

  useEffect(() => {
    if (statusData?.status === "CONNECTED") {
      setQrCode(null);
    }
  }, [statusData?.status]);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  }

  const status = statusData?.status ?? "DISCONNECTED";

  function handleConnect() {
    connect(undefined, {
      onSuccess: (data) => setQrCode(data.qrCode),
    });
  }

  if (status === "CONNECTED") {
    return (
      <div className="flex items-start justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
          <div>
            <p className="font-medium text-slate-950">WhatsApp conectado</p>
            <p className="text-sm text-slate-500">
              {statusData?.phone ?? "Número conectado"}
              {statusData?.connectedAt && (
                <> · desde {new Date(statusData.connectedAt).toLocaleDateString("pt-BR")}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onImportContacts} className="gap-2">
            <Users className="size-4" />
            Importar contatos
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => disconnect()}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? <Loader2 className="size-4 animate-spin" /> : "Desconectar"}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "CONNECTING" || qrCode) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-6">
        <div className="flex items-center gap-2 text-blue-700">
          <Smartphone className="size-5" />
          <p className="font-medium">Escaneie o QR Code</p>
        </div>

        {qrCode ? (
          <img src={qrCode} alt="QR Code WhatsApp" className="size-48 rounded-lg" />
        ) : (
          <div className="flex size-48 items-center justify-center rounded-lg bg-blue-100">
            <Loader2 className="size-8 animate-spin text-blue-400" />
          </div>
        )}

        <p className="text-center text-sm text-slate-600">
          Abra o WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho
        </p>

        <div className="flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-blue-500" />
          <span className="text-sm text-slate-500">Aguardando conexão...</span>
          <Button variant="ghost" size="sm" onClick={() => disconnect()} disabled={isDisconnecting}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (status === "BANNED") {
    return (
      <div className="flex items-start justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <XCircle className="mt-0.5 size-5 text-red-600" />
          <div>
            <p className="font-medium text-slate-950">Número banido pela Meta</p>
            <p className="text-sm text-slate-500">
              Mensagens sendo enviadas via Twilio (backup). Conecte um novo número para retomar.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={handleConnect} disabled={isConnecting} className="gap-2">
          {isConnecting ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Reconectar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
      <div className="flex items-center gap-3">
        {status === "ERROR" ? (
          <AlertTriangle className="mt-0.5 size-5 text-amber-500" />
        ) : (
          <Smartphone className="mt-0.5 size-5 text-slate-400" />
        )}
        <div>
          <p className="font-medium text-slate-950">Conectar WhatsApp próprio</p>
          <p className="text-sm text-slate-500">
            {status === "ERROR"
              ? "Erro na instância anterior. Clique em Conectar para reconectar."
              : "Conecte o número do seu negócio para enviar mensagens diretamente do seu WhatsApp."}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Conexão via QR Code. Mantenha o WhatsApp no celular conectado à internet.
          </p>
        </div>
      </div>
      <Button size="sm" onClick={handleConnect} disabled={isConnecting} className="gap-2">
        {isConnecting ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
        {isConnecting ? "Aguarde..." : "Conectar"}
      </Button>
    </div>
  );
}

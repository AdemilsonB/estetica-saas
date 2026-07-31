"use client";

import { useEffect, useState } from "react";
import { ptBR } from "react-day-picker/locale";
import { AlertTriangle, CalendarIcon, Check, Clock, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppIcon } from "@/components/domain/vitrine/vitrine-icons";
import {
  useCancelScheduledMessage,
  useCreateScheduledMessage,
  useScheduledMessageOptions,
  useScheduledMessagePreview,
  useScheduledMessages,
  useUpdateScheduledMessage,
  type ScheduledMessageItem,
  type ScheduledMessageStatus,
} from "@/hooks/notifications/use-scheduled-messages";
import { toDateInputLocal } from "@/shared/utils/day-slots";

type Props = {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
};

const ROTULO_DO_STATUS: Record<ScheduledMessageStatus, string> = {
  PENDING: "Agendado",
  SENDING: "Enviando",
  SENT: "Enviado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
};

const COR_DO_STATUS: Record<ScheduledMessageStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  SENDING: "bg-sky-50 text-sky-700 border-sky-200",
  SENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

/**
 * Recebe a data e a hora que o servidor JÁ converteu para o fuso do tenant. Nada de
 * `new Date(iso).toLocaleString()`: isso usaria o fuso do navegador e mostraria um
 * horário diferente do que a mensagem vai realmente sair.
 */
function formatarDataHora(scheduledDate: string, scheduledTime: string): string {
  const [ano, mes, dia] = scheduledDate.split("-");
  return `${dia}/${mes}/${ano} às ${scheduledTime}`;
}

function rotuloDaData(dateInput: string): string {
  if (!dateInput) return "Selecionar data";
  return new Date(`${dateInput}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ScheduledMessagesDialog({
  open,
  onClose,
  customerId,
  customerName,
}: Props) {
  const [modo, setModo] = useState<"lista" | "formulario">("lista");
  const [emEdicao, setEmEdicao] = useState<ScheduledMessageItem | null>(null);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState<string | null>(null);

  const lista = useScheduledMessages(customerId);
  const cancelar = useCancelScheduledMessage(customerId);

  function voltarParaLista() {
    setModo("lista");
    setEmEdicao(null);
  }

  function fechar() {
    voltarParaLista();
    setConfirmandoCancelamento(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WhatsAppIcon className="size-5 text-emerald-600" />
            Lembretes de {customerName}
          </DialogTitle>
          <DialogDescription>
            Mensagens de WhatsApp que saem sozinhas na data e hora que você marcar.
          </DialogDescription>
        </DialogHeader>

        {modo === "formulario" ? (
          <FormularioDeLembrete
            customerId={customerId}
            emEdicao={emEdicao}
            onPronto={voltarParaLista}
            onCancelar={voltarParaLista}
          />
        ) : (
          <div className="space-y-3">
            {lista.isLoading && (
              <div data-testid="lembretes-carregando" className="space-y-2">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            )}

            {!lista.isLoading && lista.isError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-sm text-red-700">
                  Não foi possível carregar os lembretes.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 min-h-11"
                  onClick={() => void lista.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            )}

            {!lista.isLoading && !lista.isError && (lista.data?.length ?? 0) === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                <Clock className="mx-auto size-6 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">Nenhum lembrete agendado.</p>
              </div>
            )}

            {lista.data?.map((item) => (
              <div
                key={item.id}
                className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {formatarDataHora(item.scheduledDate, item.scheduledTime)}
                    </p>
                    <p className="text-xs text-slate-400">
                      Agendado por {item.createdByUser.name}
                    </p>
                  </div>
                  <Badge className={`shrink-0 border ${COR_DO_STATUS[item.status]}`}>
                    {ROTULO_DO_STATUS[item.status]}
                  </Badge>
                </div>

                <p className="whitespace-pre-wrap rounded-lg rounded-tl-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                  {item.body}
                </p>

                {item.failureReason && (
                  <p className="flex items-start gap-1.5 text-xs text-red-600">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {item.failureReason}
                  </p>
                )}

                {item.status === "PENDING" &&
                  (confirmandoCancelamento === item.id ? (
                    // Confirmação inline: abrir um AlertDialog aqui empilharia dois
                    // Radix Dialog modais e travaria a tela.
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">Cancelar este lembrete?</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="min-h-11"
                        disabled={cancelar.isPending}
                        onClick={() =>
                          cancelar.mutate(item.id, {
                            onSuccess: () => {
                              setConfirmandoCancelamento(null);
                              toast.success("Lembrete cancelado");
                            },
                            onError: (erro) =>
                              toast.error(
                                erro instanceof Error ? erro.message : "Erro ao cancelar",
                              ),
                          })
                        }
                      >
                        <Check className="size-4" />
                        Sim, cancelar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        onClick={() => setConfirmandoCancelamento(null)}
                      >
                        Voltar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          setEmEdicao(item);
                          setModo("formulario");
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setConfirmandoCancelamento(item.id)}
                      >
                        <X className="size-4" />
                        Cancelar lembrete
                      </Button>
                    </div>
                  ))}
              </div>
            ))}

            <Button
              className="min-h-11 w-full"
              onClick={() => {
                setEmEdicao(null);
                setModo("formulario");
              }}
            >
              <Plus className="size-4" />
              Agendar lembrete
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type FormularioProps = {
  customerId: string;
  emEdicao: ScheduledMessageItem | null;
  onPronto: () => void;
  onCancelar: () => void;
};

function FormularioDeLembrete({
  customerId,
  emEdicao,
  onPronto,
  onCancelar,
}: FormularioProps) {
  const [texto, setTexto] = useState(emEdicao?.body ?? "");
  // Assenta o texto antes de entrar na queryKey da prévia — sem isso, cada tecla gera
  // uma queryKey nova e o staleTime do hook nunca chega a valer (ver I2 do review final).
  const [textoParaPrevia, setTextoParaPrevia] = useState(texto);

  useEffect(() => {
    const temporizador = setTimeout(() => setTextoParaPrevia(texto), 400);
    return () => clearTimeout(temporizador);
  }, [texto]);

  // Vêm prontos do servidor, no fuso do tenant, e voltam iguais no PATCH — nenhuma
  // conversão acontece aqui.
  const [data, setData] = useState(emEdicao?.scheduledDate ?? "");
  const [hora, setHora] = useState(emEdicao?.scheduledTime ?? "");
  const [calendarioAberto, setCalendarioAberto] = useState(false);

  const opcoes = useScheduledMessageOptions(true);
  const previa = useScheduledMessagePreview(
    { customerId, body: textoParaPrevia },
    textoParaPrevia.trim().length > 0,
  );
  const criar = useCreateScheduledMessage(customerId);
  const editar = useUpdateScheduledMessage(customerId);

  const salvando = criar.isPending || editar.isPending;
  const podeSalvar = texto.trim().length > 0 && data !== "" && hora !== "" && !salvando;

  function inserirVariavel(nome: string) {
    setTexto((atual) => `${atual}{{${nome}}}`);
  }

  function salvar() {
    const entrada = { body: texto.trim(), date: data, time: hora };
    const aoDarErro = (erro: unknown) =>
      toast.error(erro instanceof Error ? erro.message : "Erro ao salvar o lembrete");

    if (emEdicao) {
      editar.mutate(
        { id: emEdicao.id, ...entrada },
        {
          onSuccess: () => {
            toast.success("Lembrete atualizado");
            onPronto();
          },
          onError: aoDarErro,
        },
      );
      return;
    }

    criar.mutate(entrada, {
      onSuccess: () => {
        toast.success("Lembrete agendado");
        onPronto();
      },
      onError: aoDarErro,
    });
  }

  return (
    <div className="space-y-4">
      {opcoes.data && opcoes.data.templates.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="modelo-lembrete">Começar de uma mensagem pronta</Label>
          <select
            id="modelo-lembrete"
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
            value=""
            onChange={(e) => {
              const modelo = opcoes.data?.templates.find((t) => t.event === e.target.value);
              if (modelo) setTexto(modelo.body);
            }}
          >
            <option value="">Escrever do zero</option>
            {opcoes.data.templates.map((modelo) => (
              <option key={modelo.event} value={modelo.event}>
                {modelo.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="texto-lembrete">Mensagem</Label>
        <Textarea
          id="texto-lembrete"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva o que a cliente vai receber..."
          maxLength={1500}
          className="min-h-30 resize-none"
        />
        {/* Faixa rolável sem `touch-pan-x`: essa classe trava o scroll vertical no mobile. */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {opcoes.data?.variables.map((variavel) => (
            <Button
              key={variavel}
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 shrink-0 text-xs"
              onClick={() => inserirVariavel(variavel)}
            >
              {`{{${variavel}}}`}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 gap-3">
        <div className="w-3/5 min-w-0 space-y-2">
          <Label htmlFor="data-lembrete">Data</Label>
          <Popover open={calendarioAberto} onOpenChange={setCalendarioAberto}>
            <PopoverTrigger asChild>
              <Button
                id="data-lembrete"
                type="button"
                variant="outline"
                className="min-h-11 w-full min-w-0 justify-start gap-2 font-normal"
              >
                <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{rotuloDaData(data)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                className="[--cell-size:2.75rem]"
                locale={ptBR}
                defaultMonth={data ? new Date(`${data}T00:00:00`) : undefined}
                selected={data ? new Date(`${data}T00:00:00`) : undefined}
                onSelect={(d) => {
                  if (!d) return;
                  setData(toDateInputLocal(d));
                  setCalendarioAberto(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="w-2/5 min-w-24 space-y-2">
          <Label htmlFor="hora-lembrete">Horário</Label>
          <Input
            id="hora-lembrete"
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="min-h-11 px-1.5"
          />
        </div>
      </div>

      {/* Honestidade sobre a granularidade real: o cron roda a cada 10 minutos. */}
      <p className="text-xs text-slate-500">
        O envio é verificado a cada 10 minutos, então a mensagem pode sair alguns minutos
        depois do horário escolhido — nunca antes.
      </p>

      {previa.data?.blockedReason && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {previa.data.blockedReason}
        </p>
      )}

      {previa.data?.preview && (
        <div className="space-y-1">
          <Label>Como a cliente vai ver</Label>
          <div className="whitespace-pre-wrap rounded-xl rounded-tl-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            {previa.data.preview}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 flex gap-2 bg-white pt-2">
        <Button
          variant="outline"
          className="min-h-11 flex-1"
          onClick={onCancelar}
          disabled={salvando}
        >
          Voltar
        </Button>
        <Button className="min-h-11 flex-1" onClick={salvar} disabled={!podeSalvar}>
          {salvando ? "Salvando..." : emEdicao ? "Salvar alterações" : "Agendar"}
        </Button>
      </div>
    </div>
  );
}

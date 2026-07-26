"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Users,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronLeft,
  AlertTriangle,
  Crown,
  X,
  Plus,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useEvolutionContacts,
  useImportContacts,
  type EvolutionContact,
  type ImportCustomerPayload,
} from "@/hooks/settings/use-evolution-status";
import { formatBrazilianPhone } from "@/shared/utils/phone";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Step = "select" | "review" | "done";

type Draft = {
  phone: string;
  name: string;
  profilePicUrl: string | null;
  email: string;
  birthDate: string;
  notes: string;
  tagsText: string;
  isVip: boolean;
  expanded: boolean;
};

// pushName ausente, curtíssimo ou sem letra/número não serve como cadastro
function isSuspiciousName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length < 2 || !/[\p{L}\d]/u.test(trimmed);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => [...p][0] ?? "");
  return chars.join("").toUpperCase() || "?";
}

function parseTags(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 30);
}

function ContactAvatar({ name, profilePicUrl }: { name: string; profilePicUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  if (profilePicUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto externa efêmera do WhatsApp, nunca persistida
      <img
        src={profilePicUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="size-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
      {initials(name)}
    </span>
  );
}

export function EvolutionContactsImport({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [bulkTags, setBulkTags] = useState<string[]>(["whatsapp"]);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [bulkVip, setBulkVip] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);

  // Busca dispara sozinha ao abrir — o Radix não chama onOpenChange quando o
  // `open` vem do componente pai, então não dá para depender dele para carregar.
  const {
    data,
    isLoading,
    isFetching,
    error: contactsError,
    refetch,
  } = useEvolutionContacts({ enabled: open });
  const { mutate: importContacts, isPending: isImporting, error: importError } = useImportContacts();

  const contacts = useMemo(() => data?.contacts ?? [], [data]);
  const newContacts = useMemo(() => contacts.filter((c) => !c.inCrm), [contacts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, "") || q),
    );
  }, [contacts, search]);

  function resetAll() {
    setStep("select");
    setSearch("");
    setSelected(new Set());
    setDrafts([]);
    setBulkTags(["whatsapp"]);
    setBulkTagInput("");
    setBulkVip(false);
    setImportResult(null);
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) resetAll();
    onOpenChange(isOpen);
  }

  function toggleSelect(contact: EvolutionContact) {
    if (contact.inCrm) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(contact.phone)) next.delete(contact.phone);
      else next.add(contact.phone);
      return next;
    });
  }

  function toggleSelectAllNew() {
    setSelected((prev) =>
      prev.size >= newContacts.length
        ? new Set()
        : new Set(newContacts.map((c) => c.phone)),
    );
  }

  function goToReview() {
    setDrafts(
      contacts
        .filter((c) => selected.has(c.phone))
        .map((c) => ({
          phone: c.phone,
          name: c.name.trim(),
          profilePicUrl: c.profilePicUrl,
          email: "",
          birthDate: "",
          notes: "",
          tagsText: "",
          isVip: false,
          expanded: false,
        })),
    );
    setStep("review");
  }

  function updateDraft(phone: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.phone === phone ? { ...d, ...patch } : d)));
  }

  function addBulkTag() {
    const tag = bulkTagInput.trim().toLowerCase();
    if (!tag || tag.length > 30 || bulkTags.includes(tag)) {
      setBulkTagInput("");
      return;
    }
    setBulkTags((prev) => [...prev, tag]);
    setBulkTagInput("");
  }

  function handleImport() {
    const payload: ImportCustomerPayload[] = drafts.map((d) => {
      const tags = [...new Set([...bulkTags, ...parseTags(d.tagsText)])].slice(0, 10);
      return {
        name: d.name.trim(),
        phone: d.phone,
        email: d.email.trim() || undefined,
        birthDate: d.birthDate || undefined,
        notes: d.notes.trim() || undefined,
        tags,
        isVip: bulkVip || d.isVip || undefined,
      };
    });

    importContacts(payload, {
      onSuccess: (result) => {
        setImportResult(result);
        setStep("done");
      },
    });
  }

  const selectedCount = selected.size;
  const invalidNames = drafts.filter((d) => d.name.trim().length === 0).length;
  const invalidEmails = drafts.filter(
    (d) => d.email.trim().length > 0 && !/^\S+@\S+\.\S+$/.test(d.email.trim()),
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>
              {step === "review" ? "Revisar e enriquecer" : "Importar do WhatsApp"}
            </span>
            {step !== "done" && (
              <span className="text-xs font-normal text-slate-400">
                Passo {step === "select" ? "1" : "2"} de 2
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ─── Concluído ─── */}
        {step === "done" && importResult && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-emerald-500" />
            <p className="font-medium text-slate-900">
              {importResult.created} cliente{importResult.created !== 1 ? "s" : ""} importado{importResult.created !== 1 ? "s" : ""}
            </p>
            {importResult.skipped > 0 && (
              <p className="text-sm text-slate-500">
                {importResult.skipped} já existia{importResult.skipped !== 1 ? "m" : ""} no CRM
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetAll();
                  refetch();
                }}
              >
                Importar mais
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
            </div>
          </div>
        )}

        {/* ─── Passo 1: selecionar ─── */}
        {step === "select" && (
          <>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar por nome ou número..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                {newContacts.length > 0 ? (
                  <button
                    type="button"
                    onClick={toggleSelectAllNew}
                    className="text-xs font-medium text-primary underline underline-offset-2"
                  >
                    {selectedCount >= newContacts.length
                      ? "Desmarcar todos"
                      : `Selecionar todos os novos (${newContacts.length})`}
                  </button>
                ) : (
                  <span />
                )}
                {/* Revalidação em segundo plano: a lista em cache continua visível */}
                {isFetching && !isLoading && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Loader2 className="size-3 animate-spin" />
                    atualizando
                  </span>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-slate-400" />
                </div>
              ) : contactsError ? (
                <div className="flex h-40 flex-col items-center justify-center gap-3 px-6 text-center">
                  <AlertTriangle className="size-6 text-amber-500" />
                  <p className="text-sm text-slate-500">{contactsError.message}</p>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="text-sm text-slate-400">
                    {search
                      ? "Nenhum contato encontrado"
                      : "Nenhum contato sincronizado ainda. O WhatsApp pode levar alguns instantes para carregar os contatos após conectar."}
                  </p>
                  {!search && (
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                      Atualizar
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-1 py-1">
                  {filtered.map((contact) => {
                    const isSelected = selected.has(contact.phone);
                    const suspicious = !contact.inCrm && isSuspiciousName(contact.name);
                    return (
                      <button
                        key={contact.phone}
                        type="button"
                        onClick={() => toggleSelect(contact)}
                        disabled={contact.inCrm}
                        className={[
                          "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                          contact.inCrm
                            ? "cursor-default opacity-60"
                            : isSelected
                            ? "bg-emerald-50 ring-1 ring-emerald-200"
                            : "hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={[
                              "flex size-5 shrink-0 items-center justify-center rounded border text-xs",
                              contact.inCrm
                                ? "border-slate-300 bg-slate-100"
                                : isSelected
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-slate-300",
                            ].join(" ")}
                          >
                            {(contact.inCrm || isSelected) && "✓"}
                          </div>
                          <ContactAvatar name={contact.name} profilePicUrl={contact.profilePicUrl} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {contact.name.trim() || "(sem nome no WhatsApp)"}
                              {suspicious && (
                                <AlertTriangle className="ml-1.5 inline size-3.5 text-amber-500" />
                              )}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatBrazilianPhone(contact.phone)}
                            </p>
                          </div>
                        </div>
                        {contact.inCrm && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            já no CRM
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500">
                {newContacts.length} novo{newContacts.length !== 1 ? "s" : ""} ·{" "}
                {contacts.length - newContacts.length} já no CRM
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={goToReview} disabled={selectedCount === 0} className="gap-2">
                  <Users className="size-4" />
                  Revisar {selectedCount > 0 ? `(${selectedCount})` : ""}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ─── Passo 2: revisar e enriquecer ─── */}
        {step === "review" && (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Aplicar a todos
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {bulkTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 rounded-full">
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remover tag ${tag}`}
                      onClick={() => setBulkTags((prev) => prev.filter((t) => t !== tag))}
                      className="-mr-0.5 rounded-full p-0.5 hover:bg-slate-200"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    value={bulkTagInput}
                    onChange={(e) => setBulkTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addBulkTag();
                      }
                    }}
                    placeholder="nova tag"
                    className="h-8 w-28 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Adicionar tag"
                    onClick={addBulkTag}
                    className="size-8"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <Crown className="size-4 text-amber-500" />
                  VIP
                  <Switch checked={bulkVip} onCheckedChange={setBulkVip} />
                </label>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-1">
              {drafts.map((draft) => {
                const suspicious = isSuspiciousName(draft.name);
                return (
                  <div
                    key={draft.phone}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <ContactAvatar name={draft.name} profilePicUrl={draft.profilePicUrl} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Input
                            value={draft.name}
                            onChange={(e) => updateDraft(draft.phone, { name: e.target.value })}
                            placeholder="Nome do cliente *"
                            aria-label={`Nome do cliente ${formatBrazilianPhone(draft.phone)}`}
                            className={suspicious ? "border-amber-300" : undefined}
                          />
                          {suspicious && (
                            <span className="flex shrink-0 items-center gap-1 text-xs text-amber-600">
                              <AlertTriangle className="size-3.5" />
                              revisar
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {formatBrazilianPhone(draft.phone)} · WhatsApp
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateDraft(draft.phone, { expanded: !draft.expanded })}
                      className="mt-2 flex min-h-8 items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                      <ChevronDown
                        className={`size-3.5 transition-transform ${draft.expanded ? "rotate-180" : ""}`}
                      />
                      {draft.expanded ? "menos campos" : "mais campos"}
                    </button>

                    {draft.expanded && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs text-slate-500">E-mail</Label>
                          <Input
                            type="email"
                            value={draft.email}
                            onChange={(e) => updateDraft(draft.phone, { email: e.target.value })}
                            placeholder="email@exemplo.com"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Nascimento</Label>
                          <Input
                            type="date"
                            value={draft.birthDate}
                            onChange={(e) => updateDraft(draft.phone, { birthDate: e.target.value })}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs text-slate-500">Nota</Label>
                          <Textarea
                            rows={2}
                            value={draft.notes}
                            onChange={(e) => updateDraft(draft.phone, { notes: e.target.value })}
                            placeholder="Preferências, histórico..."
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">
                            Tags próprias (separadas por vírgula)
                          </Label>
                          <Input
                            value={draft.tagsText}
                            onChange={(e) => updateDraft(draft.phone, { tagsText: e.target.value })}
                            placeholder="ex.: indicação, mechas"
                          />
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-slate-700">
                          <Crown className="size-4 text-amber-500" />
                          VIP
                          <Switch
                            checked={bulkVip || draft.isVip}
                            disabled={bulkVip}
                            onCheckedChange={(v) => updateDraft(draft.phone, { isVip: v })}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-500">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Importados sem consentimento de marketing — ele é registrado quando o
                cliente aceitar no portal. Origem gravada: WhatsApp.
              </p>
              {importError && (
                <p className="text-xs text-red-600">{importError.message}</p>
              )}
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep("select")} className="gap-1">
                  <ChevronLeft className="size-4" />
                  Voltar
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={drafts.length === 0 || invalidNames > 0 || invalidEmails > 0 || isImporting}
                  className="gap-2"
                >
                  {isImporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Salvar {drafts.length} cliente{drafts.length !== 1 ? "s" : ""}
                </Button>
              </div>
              {invalidNames > 0 && (
                <p className="text-xs text-amber-600">
                  {invalidNames} contato{invalidNames !== 1 ? "s" : ""} sem nome — preencha para salvar.
                </p>
              )}
              {invalidEmails > 0 && (
                <p className="text-xs text-amber-600">
                  {invalidEmails} e-mail{invalidEmails !== 1 ? "s" : ""} inválido{invalidEmails !== 1 ? "s" : ""} — corrija ou deixe em branco.
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Search, Users, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useEvolutionContacts,
  useImportContacts,
  type EvolutionContact,
} from "@/hooks/settings/use-evolution-status";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EvolutionContactsImport({ open, onOpenChange }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);

  const { data, isLoading, refetch } = useEvolutionContacts();
  const { mutate: importContacts, isPending: isImporting } = useImportContacts();

  const contacts = data?.contacts ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [contacts, search]);

  function handleOpenChange(isOpen: boolean) {
    if (isOpen && contacts.length === 0) {
      refetch();
    }
    if (!isOpen) {
      setSelected(new Set());
      setImportResult(null);
      setSearch("");
    }
    onOpenChange(isOpen);
  }

  function toggleSelect(contact: EvolutionContact) {
    if (contact.inCrm) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(contact.phone)) {
        next.delete(contact.phone);
      } else {
        next.add(contact.phone);
      }
      return next;
    });
  }

  function handleImport() {
    const toImport = contacts
      .filter((c) => selected.has(c.phone))
      .map((c) => ({ name: c.name, phone: c.phone }));

    importContacts(toImport, {
      onSuccess: (result) => {
        setImportResult(result);
        setSelected(new Set());
      },
    });
  }

  const selectedCount = selected.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar contatos do WhatsApp</DialogTitle>
        </DialogHeader>

        {importResult ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-emerald-500" />
            <p className="font-medium text-slate-900">
              {importResult.created} contato{importResult.created !== 1 ? "s" : ""} importado{importResult.created !== 1 ? "s" : ""}
            </p>
            {importResult.skipped > 0 && (
              <p className="text-sm text-slate-500">
                {importResult.skipped} já existia{importResult.skipped !== 1 ? "m" : ""} no CRM
              </p>
            )}
            <Button variant="outline" onClick={() => { setImportResult(null); refetch(); }}>
              Importar mais
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nome ou número..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-slate-400" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex h-40 items-center justify-center">
                  <p className="text-sm text-slate-400">
                    {search ? "Nenhum contato encontrado" : "Nenhum contato disponível"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1 py-1">
                  {filtered.map((contact) => {
                    const isSelected = selected.has(contact.phone);
                    return (
                      <button
                        key={contact.phone}
                        type="button"
                        onClick={() => toggleSelect(contact)}
                        disabled={contact.inCrm}
                        className={[
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors",
                          contact.inCrm
                            ? "cursor-default opacity-60"
                            : isSelected
                            ? "bg-emerald-50 ring-1 ring-emerald-200"
                            : "hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <div className={[
                            "flex size-5 items-center justify-center rounded border text-xs",
                            contact.inCrm
                              ? "border-slate-300 bg-slate-100"
                              : isSelected
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-300",
                          ].join(" ")}>
                            {(contact.inCrm || isSelected) && "✓"}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{contact.name}</p>
                            <p className="text-xs text-slate-500">+{contact.phone}</p>
                          </div>
                        </div>
                        {contact.inCrm && (
                          <Badge variant="secondary" className="text-xs">no CRM</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              <div className="flex w-full items-center justify-between">
                <p className="text-sm text-slate-500">
                  {selectedCount > 0
                    ? `${selectedCount} selecionado${selectedCount !== 1 ? "s" : ""}`
                    : "Nenhum selecionado"}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Fechar
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={selectedCount === 0 || isImporting}
                    className="gap-2"
                  >
                    {isImporting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Users className="size-4" />
                    )}
                    Importar selecionados
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

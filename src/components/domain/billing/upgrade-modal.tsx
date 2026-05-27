"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type UpgradeModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature?: string
  requiredPlan?: string
}

const PLAN_LABEL: Record<string, string> = {
  FREE: "Free",
  STARTER: "Starter",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
}

const FEATURE_LABEL: Record<string, string> = {
  whatsapp_basic:   "WhatsApp (envio de mensagens)",
  whatsapp_premium: "WhatsApp Premium (Meta Cloud API)",
  reports_advanced: "Relatórios avançados",
  campaigns:        "Campanhas de marketing",
  multi_unit:       "Multi-unidade",
}

export function UpgradeModal({ open, onOpenChange, feature, requiredPlan }: UpgradeModalProps) {
  const featureLabel = feature ? (FEATURE_LABEL[feature] ?? feature) : "esta funcionalidade"
  const planLabel = requiredPlan ? (PLAN_LABEL[requiredPlan] ?? requiredPlan) : "um plano superior"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade necessário</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{featureLabel}</span> requer o plano{" "}
            <Badge variant="secondary">{planLabel}</Badge> ou superior.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Faça upgrade do seu plano para desbloquear esta e outras funcionalidades:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>WhatsApp automático de confirmação e lembrete</li>
            <li>Relatórios avançados por profissional</li>
            <li>Campanhas de marketing segmentadas</li>
          </ul>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" asChild>
            <a
              href="https://wa.me/5500000000000?text=Quero+fazer+upgrade+do+meu+plano"
              target="_blank"
              rel="noopener noreferrer"
            >
              Falar com suporte
            </a>
          </Button>
          <Button asChild>
            <a href="/configuracoes/planos">Ver planos</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

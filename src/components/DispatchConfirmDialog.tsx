"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  Send,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  Clock,
  DollarSign,
  Users,
  MessageSquare,
  Tag,
  UserCheck,
  Inbox as InboxIcon,
} from "lucide-react";
import {
  estimateCostUsd,
  estimateTimeSeconds,
  formatBrl,
  formatDuration,
  formatUsd,
  usdToBrl,
} from "@/lib/costs";
import type { Conversation, Template, TemplateVarsConfig } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  submitting: boolean;

  inboxName: string | null;
  template: Template | null;
  variablesConfig: TemplateVarsConfig;
  conversations: Conversation[];
  delayMin: number;
  delayMax: number;
  blacklistDays: number;
  scheduledAt: string | null;
  sendMode: "chatwoot" | "whatsapp_direct";
  openConversation: boolean;
  assignAgentId: number | null;
  agents: { id: number; name: string }[];
  postSendLabels: string[];
}

const VAR_TYPE_LABEL: Record<string, string> = {
  fixed: "Texto fixo",
  contact_name: "Nome do contato",
  contact_phone: "Telefone do contato",
};

function formatScheduledAt(value: string | null): string {
  if (!value) return "Imediato";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DispatchConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting,
  inboxName,
  template,
  variablesConfig,
  conversations,
  delayMin,
  delayMax,
  blacklistDays,
  scheduledAt,
  sendMode,
  openConversation,
  assignAgentId,
  agents,
  postSendLabels,
}: Props) {
  const selected = conversations.filter((c) => c.selected);
  const total = selected.length;
  const category = template?.category || "MARKETING";
  const cost = estimateCostUsd(total, category);
  const timeSec = estimateTimeSeconds(total, delayMin, delayMax);
  const isScheduled = !!scheduledAt;
  const assignedAgent = assignAgentId ? agents.find((a) => a.id === assignAgentId) : null;

  const variableEntries = Object.entries(variablesConfig).filter(
    ([key]) => key !== "header_media_url"
  );
  const headerMediaUrl = variablesConfig["header_media_url"]?.value;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Confirmar Disparo
          </DialogTitle>
          <DialogDescription>
            Revise os dados abaixo antes de {isScheduled ? "agendar" : "iniciar"} o disparo. Esta
            acao nao podera ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-5 pb-2">
            {/* Caixa de entrada */}
            <Section icon={<InboxIcon className="h-4 w-4" />} title="Caixa de Entrada">
              <p className="text-sm">{inboxName || "—"}</p>
            </Section>

            <Separator />

            {/* Template */}
            <Section icon={<MessageSquare className="h-4 w-4" />} title="Template">
              <div className="space-y-2">
                <p className="text-sm font-medium">{template?.name || "—"}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{category}</Badge>
                  {template?.language && (
                    <Badge variant="outline">{template.language}</Badge>
                  )}
                </div>
                {variableEntries.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Variaveis</p>
                    <div className="rounded-md border bg-muted/30 p-2 space-y-1">
                      {variableEntries.map(([key, cfg]) => (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-muted-foreground">
                            {`{{${key}}}`}
                          </span>
                          <span>→</span>
                          <span className="font-medium">
                            {VAR_TYPE_LABEL[cfg.type] || cfg.type}
                          </span>
                          {cfg.type === "fixed" && cfg.value && (
                            <span className="text-muted-foreground truncate">
                              "{cfg.value}"
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {headerMediaUrl && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium">Header media:</span>{" "}
                    <span className="break-all">{headerMediaUrl}</span>
                  </div>
                )}
              </div>
            </Section>

            <Separator />

            {/* Modo de envio */}
            <Section
              icon={
                sendMode === "whatsapp_direct" ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )
              }
              title="Modo de Envio"
            >
              {sendMode === "whatsapp_direct" ? (
                <div>
                  <Badge variant="default" className="bg-purple-600 hover:bg-purple-600">
                    WhatsApp Direto
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mensagens nao aparecerao nas conversas do Chatwoot.
                  </p>
                </div>
              ) : (
                <div>
                  <Badge variant="default">Via Chatwoot</Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mensagens ficarao registradas nas conversas do Chatwoot.
                  </p>
                </div>
              )}
            </Section>

            <Separator />

            {/* Conversas */}
            <Section
              icon={<Users className="h-4 w-4" />}
              title={`Destinatarios (${total})`}
            >
              {total === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum destinatario.</p>
              ) : (
                <div className="rounded-md border max-h-40 overflow-auto">
                  <ul className="divide-y text-xs">
                    {selected.slice(0, 200).map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 px-3 py-1.5"
                      >
                        <span className="truncate">
                          {c.contact?.name || `Conversa #${c.id}`}
                        </span>
                        {c.contact?.phone_number && (
                          <span className="text-muted-foreground font-mono">
                            {c.contact.phone_number}
                          </span>
                        )}
                      </li>
                    ))}
                    {selected.length > 200 && (
                      <li className="px-3 py-1.5 text-muted-foreground">
                        + {selected.length - 200} outros…
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </Section>

            <Separator />

            {/* Configuracao */}
            <Section icon={<Clock className="h-4 w-4" />} title="Configuracao">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Delay entre msgs</dt>
                <dd className="font-medium">
                  {delayMin}s – {delayMax}s
                </dd>

                <dt className="text-muted-foreground">Blacklist</dt>
                <dd className="font-medium">
                  {blacklistDays > 0
                    ? `Ignorar reenvio em ${blacklistDays} dia${blacklistDays !== 1 ? "s" : ""}`
                    : "Desativada"}
                </dd>

                <dt className="text-muted-foreground">Quando</dt>
                <dd className="font-medium flex items-center gap-1">
                  {isScheduled && <Calendar className="h-3.5 w-3.5" />}
                  {formatScheduledAt(scheduledAt)}
                </dd>

                <dt className="text-muted-foreground">Tempo estimado</dt>
                <dd className="font-medium">
                  {timeSec > 0 ? formatDuration(timeSec) : "—"}
                </dd>
              </dl>
            </Section>

            <Separator />

            {/* Pos-envio */}
            <Section icon={<Tag className="h-4 w-4" />} title="Acoes pos-envio">
              <ul className="text-sm space-y-1.5">
                <li className="flex items-center gap-2">
                  <span
                    className={
                      openConversation ? "text-green-600" : "text-muted-foreground"
                    }
                  >
                    {openConversation ? "✓" : "—"}
                  </span>
                  <span>Abrir conversa apos envio</span>
                </li>
                <li className="flex items-center gap-2">
                  <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Atribuir agente:</span>
                  <span className="font-medium">
                    {assignedAgent ? assignedAgent.name : "Nenhum"}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                  <span>Etiquetas:</span>
                  {postSendLabels.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {postSendLabels.map((l) => (
                        <Badge key={l} variant="secondary" className="text-xs">
                          {l}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="font-medium">Nenhuma</span>
                  )}
                </li>
              </ul>
            </Section>

            <Separator />

            {/* Custo */}
            <Section icon={<DollarSign className="h-4 w-4" />} title="Custo Estimado">
              <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{formatBrl(usdToBrl(cost))}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatUsd(cost)} ({total} msgs × {category})
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </Section>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={submitting || total === 0}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isScheduled ? (
              <Calendar className="mr-2 h-4 w-4" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {isScheduled ? "Confirmar e Agendar" : "Confirmar e Disparar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

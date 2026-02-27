"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import InboxSelector from "@/components/InboxSelector";
import TemplateSelector from "@/components/TemplateSelector";
import TemplateVariables from "@/components/TemplateVariables";
import FunnelStageSelector from "@/components/FunnelStageSelector";
import LabelSelector from "@/components/LabelSelector";
import ConversationList from "@/components/ConversationList";
import DispatchConfig from "@/components/DispatchConfig";
import BlacklistNotice from "@/components/BlacklistNotice";
import LastActivityFilter, {
  type ActivityFilterValue,
  filterByActivity,
} from "@/components/LastActivityFilter";
import { api } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { estimateCostUsd } from "@/lib/costs";
import type { Template, Conversation, TemplateVarsConfig } from "@/types";
import { Send, Loader2, Calendar, ArrowLeft } from "lucide-react";

interface Props {
  accountId: number;
  onDispatchCreated: (dispatchId: string) => void;
  onBack?: () => void;
}

export default function DispatchForm({ accountId, onDispatchCreated, onBack }: Props) {
  const [inboxId, setInboxId] = useState<number | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [variablesConfig, setVariablesConfig] = useState<TemplateVarsConfig>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilterValue>("all");
  const [delayMin, setDelayMin] = useState(5);
  const [delayMax, setDelayMax] = useState(15);
  const [blacklistDays, setBlacklistDays] = useState(7);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);

  const [blacklistFiltered, setBlacklistFiltered] = useState(0);
  const [blacklistTotal, setBlacklistTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleInboxChange = (id: number) => {
    setInboxId(id);
    setTemplate(null);
    setVariablesConfig({});
  };

  const handleTemplateChange = (tpl: Template) => {
    setTemplate(tpl);
    setVariablesConfig({});
    setBlacklistFiltered(0);
  };

  const handleKanbanConversations = useCallback((convs: Conversation[]) => {
    setConversations((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const unique = convs.filter((c) => !existingIds.has(c.id));
      return [...prev, ...unique];
    });
  }, []);

  const handleLabelConversations = useCallback((convs: Conversation[]) => {
    const mapped = convs.map((c) => ({ ...c, selected: true }));
    setConversations((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const unique = mapped.filter((c) => !existingIds.has(c.id));
      return [...prev, ...unique];
    });
  }, []);

  const toggleConversation = (id: number) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const selectAll = () =>
    setConversations((prev) => prev.map((c) => ({ ...c, selected: true })));
  const deselectAll = () =>
    setConversations((prev) => prev.map((c) => ({ ...c, selected: false })));

  // Apply activity filter
  const filteredConversations = useMemo(
    () => filterByActivity(conversations, activityFilter),
    [conversations, activityFilter]
  );

  // Build processed params for base (used in template_config for cron)
  const buildProcessedParams = (contact: { name?: string; phone_number?: string }) => {
    const bodyParams: Record<string, string> = {};
    for (const [key, config] of Object.entries(variablesConfig)) {
      if (key === "header_media_url") continue;
      const varConfig = variablesConfig[key];
      if (!varConfig) continue;
      switch (varConfig.type) {
        case "contact_name":
          bodyParams[key] = contact.name || "";
          break;
        case "contact_phone":
          bodyParams[key] = contact.phone_number || "";
          break;
        case "fixed":
        default:
          bodyParams[key] = varConfig.value || "";
          break;
      }
    }

    const headerComponent = template?.components?.find((c) => c.type === "HEADER");
    const hasHeaderMedia =
      headerComponent?.format === "IMAGE" ||
      headerComponent?.format === "VIDEO" ||
      headerComponent?.format === "DOCUMENT";

    const processedParams: Record<string, any> = { body: bodyParams };
    const headerMediaUrl = variablesConfig["header_media_url"]?.value;
    if (hasHeaderMedia && headerMediaUrl) {
      processedParams.header = {
        media_url: headerMediaUrl,
        media_type: headerComponent?.format?.toLowerCase(),
      };
    }

    return processedParams;
  };

  const handleDispatch = async () => {
    if (!accountId || !inboxId || !template) return;

    let selectedConvs = filteredConversations.filter((c) => c.selected);
    if (selectedConvs.length === 0) return;

    setSubmitting(true);
    const category = template.category || "MARKETING";

    // Blacklist check
    if (blacklistDays > 0) {
      try {
        const { blocked_ids } = await api.checkBlacklist({
          conversation_ids: selectedConvs.map((c) => c.id),
          template_name: template.name,
          days: blacklistDays,
        });
        if (blocked_ids.length > 0) {
          setBlacklistTotal(selectedConvs.length);
          setBlacklistFiltered(blocked_ids.length);
          selectedConvs = selectedConvs.filter((c) => !blocked_ids.includes(c.id));
        }
      } catch {
        // continue without blacklist
      }
    }

    if (selectedConvs.length === 0) {
      setSubmitting(false);
      return;
    }

    const sb = getSupabase();
    if (!sb) {
      setSubmitting(false);
      return;
    }

    const isScheduled = !!scheduledAt;
    const estimatedCost = estimateCostUsd(selectedConvs.length, category);

    const templatePayloadBase = {
      name: template.name,
      language: template.language,
      category,
    };

    // Save dispatch to Supabase
    const { data: dispatch } = await sb
      .from("dispatches")
      .insert({
        account_id: accountId,
        inbox_id: inboxId,
        template_name: template.name,
        template_category: category,
        total_conversations: selectedConvs.length,
        status: isScheduled ? "scheduled" : "pending",
        scheduled_at: isScheduled ? new Date(scheduledAt!).toISOString() : null,
        // Note: datetime-local gives local time, new Date() parses it as local, .toISOString() converts to UTC
        estimated_cost_usd: estimatedCost,
        delay_min: delayMin,
        delay_max: delayMax,
        template_config: {
          ...templatePayloadBase,
          processedParams: buildProcessedParams({}),
          variablesConfig,
          components: template.components || [],
        },
        conversation_data: selectedConvs.map((c) => ({
          conversation_id: c.id,
          contact_name: c.contact?.name,
          contact_phone: c.contact?.phone_number,
        })),
      })
      .select()
      .single();

    const dispatchId = dispatch?.id;
    if (!dispatchId) {
      setSubmitting(false);
      return;
    }

    // Pre-insert dispatch_messages
    const messages = selectedConvs.map((c) => ({
      dispatch_id: dispatchId,
      conversation_id: c.id,
      contact_name: c.contact?.name || null,
      contact_phone: c.contact?.phone_number || null,
      template_name: template.name,
      template_category: category,
      status: "pending",
    }));
    await sb.from("dispatch_messages").insert(messages);

    // Monitor will auto-detect pending status and trigger /start
    setSubmitting(false);
    onDispatchCreated(dispatchId);
  };

  const selectedCount = filteredConversations.filter((c) => c.selected).length;
  const canDispatch =
    accountId &&
    inboxId &&
    template &&
    selectedCount > 0 &&
    delayMin > 0 &&
    delayMax >= delayMin &&
    !submitting;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Overview
        </Button>
      )}

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Novo Disparo</h2>
        <p className="text-muted-foreground">
          Configure e dispare mensagens WhatsApp em massa via Chatwoot.
        </p>
      </div>

      {/* Step 1: Inbox */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Selecionar Caixa de Entrada</CardTitle>
        </CardHeader>
        <CardContent>
          <InboxSelector accountId={accountId} value={inboxId} onChange={handleInboxChange} />
        </CardContent>
      </Card>

      {/* Step 2: Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Selecionar Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TemplateSelector
            accountId={accountId}
            inboxId={inboxId}
            value={template}
            onChange={handleTemplateChange}
            variablesConfig={variablesConfig}
          />
          <TemplateVariables
            template={template}
            variablesConfig={variablesConfig}
            onChange={setVariablesConfig}
          />
        </CardContent>
      </Card>

      {/* Step 3: Conversations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">3. Selecionar Conversas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">CRM Kanban</h4>
              <FunnelStageSelector
                accountId={accountId}
                onConversationsLoaded={handleKanbanConversations}
              />
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2">Etiquetas</h4>
              <LabelSelector
                accountId={accountId}
                onConversationsLoaded={handleLabelConversations}
              />
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <LastActivityFilter value={activityFilter} onChange={setActivityFilter} />
            {activityFilter !== "all" && conversations.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {filteredConversations.length} de {conversations.length} conversas
              </span>
            )}
          </div>
          <ConversationList
            conversations={filteredConversations}
            onToggle={toggleConversation}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
          />
        </CardContent>
      </Card>

      {/* Step 4: Config & Dispatch */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">4. Configurar e Disparar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DispatchConfig
            delayMin={delayMin}
            delayMax={delayMax}
            onDelayMinChange={setDelayMin}
            onDelayMaxChange={setDelayMax}
            blacklistDays={blacklistDays}
            onBlacklistDaysChange={setBlacklistDays}
            scheduledAt={scheduledAt}
            onScheduleChange={setScheduledAt}
            messageCount={selectedCount}
            templateCategory={template?.category || "MARKETING"}
          />

          <Separator />

          {blacklistFiltered > 0 && (
            <BlacklistNotice filteredCount={blacklistFiltered} totalCount={blacklistTotal} />
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedCount > 0 ? (
                <span>
                  {selectedCount} conversa{selectedCount !== 1 ? "s" : ""} selecionada
                  {selectedCount !== 1 ? "s" : ""}
                </span>
              ) : (
                <span>Nenhuma conversa selecionada</span>
              )}
            </div>
            <Button size="lg" onClick={handleDispatch} disabled={!canDispatch}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : scheduledAt ? (
                <Calendar className="mr-2 h-4 w-4" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {scheduledAt ? "Agendar Disparo" : "Disparar Mensagens"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

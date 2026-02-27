"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import type { Conversation } from "@/types";
import { Loader2 } from "lucide-react";

interface FunnelData {
  id: number;
  name: string;
}

interface StageData {
  id: string;
  name: string;
  position: number;
}

interface Props {
  accountId: number | null;
  onConversationsLoaded: (conversations: Conversation[]) => void;
}

export default function FunnelStageSelector({ accountId, onConversationsLoaded }: Props) {
  const [funnels, setFunnels] = useState<FunnelData[]>([]);
  const [stages, setStages] = useState<StageData[]>([]);
  const [selectedFunnel, setSelectedFunnel] = useState<number | null>(null);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [loadingFunnels, setLoadingFunnels] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadStatus, setLoadStatus] = useState("");

  useEffect(() => {
    if (!accountId) return;
    setLoadingFunnels(true);
    api.getFunnels(accountId)
      .then(setFunnels)
      .catch(console.error)
      .finally(() => setLoadingFunnels(false));
  }, [accountId]);

  useEffect(() => {
    if (!accountId || !selectedFunnel) {
      setStages([]);
      return;
    }
    setLoadingStages(true);
    api.getFunnelStages(accountId, selectedFunnel)
      .then(setStages)
      .catch(console.error)
      .finally(() => setLoadingStages(false));
  }, [accountId, selectedFunnel]);

  const toggleStage = (stageId: string) => {
    setSelectedStages((prev) =>
      prev.includes(stageId)
        ? prev.filter((id) => id !== stageId)
        : [...prev, stageId]
    );
    setLoadStatus("");
  };

  const loadKanbanItems = async () => {
    if (!accountId || !selectedFunnel || selectedStages.length === 0) return;
    setLoadingItems(true);
    setLoadStatus("Carregando cards do Kanban...");

    let allConversations: Conversation[] = [];
    let totalLoaded = 0;
    let totalPages = 0;
    const seenIds = new Set<number>();

    try {
      for (const stageId of selectedStages) {
        const stageName = stages.find((s) => s.id === stageId)?.name || stageId;
        setLoadStatus(`Carregando etapa "${stageName}"...`);

        const result = await api.getKanbanItems(accountId, {
          funnel_id: selectedFunnel.toString(),
          stage_id: stageId,
        });

        const conversations: Conversation[] = result.items
          .filter((item: any) => {
            if (seenIds.has(item.conversation_id)) return false;
            seenIds.add(item.conversation_id);
            return true;
          })
          .map((item: any) => ({
            id: item.conversation_id,
            inbox_id: 0,
            status: "open",
            contact: {
              id: 0,
              name: item.name,
              phone_number: item.phone_number,
            },
            labels: [],
            selected: true,
            last_activity_at: item.last_activity_at || undefined,
          }));

        allConversations = [...allConversations, ...conversations];
        totalLoaded += result.total;
        totalPages += result.pages_fetched;
      }

      setLoadStatus(
        `${allConversations.length} conversas carregadas de ${selectedStages.length} etapa${selectedStages.length > 1 ? "s" : ""} (${totalPages} paginas)`
      );
      onConversationsLoaded(allConversations);
    } catch (error: any) {
      console.error("Error loading kanban items:", error);
      setLoadStatus(`Erro: ${error.message}`);
    } finally {
      setLoadingItems(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">CRM Kanban</Label>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Funil</Label>
          <Select
            value={selectedFunnel?.toString() || ""}
            onValueChange={(v) => {
              setSelectedFunnel(parseInt(v));
              setSelectedStages([]);
              setLoadStatus("");
            }}
            disabled={!accountId || loadingFunnels}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingFunnels ? "Carregando..." : "Selecione o funil"} />
            </SelectTrigger>
            <SelectContent>
              {funnels.map((funnel) => (
                <SelectItem key={funnel.id} value={funnel.id.toString()}>
                  {funnel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {stages.length > 0 && (
          <div className="space-y-2">
            <Label>
              Etapas{" "}
              {selectedStages.length > 0 && (
                <span className="text-muted-foreground font-normal">
                  ({selectedStages.length} selecionada{selectedStages.length > 1 ? "s" : ""})
                </span>
              )}
            </Label>
            <div className="rounded-md border p-3 space-y-2 max-h-[200px] overflow-y-auto">
              {loadingStages ? (
                <p className="text-sm text-muted-foreground">Carregando etapas...</p>
              ) : (
                stages.map((stage) => (
                  <label
                    key={stage.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                  >
                    <Checkbox
                      checked={selectedStages.includes(stage.id)}
                      onCheckedChange={() => toggleStage(stage.id)}
                    />
                    <span className="text-sm">{stage.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <Button
        onClick={loadKanbanItems}
        disabled={!selectedFunnel || selectedStages.length === 0 || loadingItems}
        className="w-full"
        variant="secondary"
      >
        {loadingItems && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loadingItems
          ? "Carregando todas as paginas..."
          : `Carregar Conversas${selectedStages.length > 1 ? ` (${selectedStages.length} etapas)` : ""}`}
      </Button>

      {loadStatus && (
        <p className="text-sm text-muted-foreground text-center">{loadStatus}</p>
      )}
    </div>
  );
}

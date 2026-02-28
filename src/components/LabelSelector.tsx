"use client";

import { useEffect, useState } from "react";
import { Label as UILabel } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import type { Label, Conversation } from "@/types";
import { Loader2 } from "lucide-react";

interface Props {
  accountId: number | null;
  onConversationsLoaded: (conversations: Conversation[]) => void;
}

export default function LabelSelector({ accountId, onConversationsLoaded }: Props) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    api.getLabels(accountId)
      .then(setLabels)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [accountId]);

  const toggleLabel = (title: string) => {
    setSelectedLabels((prev) =>
      prev.includes(title) ? prev.filter((l) => l !== title) : [...prev, title]
    );
  };

  const loadConversations = async () => {
    if (!accountId || selectedLabels.length === 0) return;
    setLoadingConversations(true);
    try {
      const filterPayload = {
        payload: selectedLabels.map((label, index) => ({
          attribute_key: "labels",
          filter_operator: "equal_to",
          values: [label],
          ...(index < selectedLabels.length - 1 ? { query_operator: "OR" as const } : {}),
        })),
      };

      let allConversations: Conversation[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const result = await api.filterConversations(accountId, filterPayload, page);
        const mapped: Conversation[] = (result.data || []).map((c: any) => ({
          id: c.id,
          inbox_id: c.inbox_id || 0,
          status: c.status || "open",
          contact: {
            id: c.meta?.sender?.id || c.contact?.id || 0,
            name: c.meta?.sender?.name || c.contact?.name || "",
            phone_number: c.meta?.sender?.phone_number || c.contact?.phone_number || "",
          },
          labels: c.labels || [],
          selected: true,
          last_activity_at: c.last_activity_at || undefined,
        }));
        allConversations = [...allConversations, ...mapped];
        hasMore = mapped.length > 0 && allConversations.length < result.meta.all_count;
        page++;
        if (page > 50) break; // Safety limit
      }

      onConversationsLoaded(allConversations);
    } catch (error) {
      console.error("Error loading conversations by labels:", error);
    } finally {
      setLoadingConversations(false);
    }
  };

  return (
    <div className="space-y-3">
      <UILabel className="text-base font-semibold">Etiquetas (Labels)</UILabel>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando etiquetas...</p>
      ) : (
        <ScrollArea className="h-40 rounded-md border p-3">
          <div className="space-y-2">
            {labels.map((label) => (
              <div key={label.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`label-${label.id}`}
                  checked={selectedLabels.includes(label.title)}
                  onCheckedChange={() => toggleLabel(label.title)}
                />
                <label
                  htmlFor={`label-${label.id}`}
                  className="text-sm cursor-pointer flex items-center gap-2"
                >
                  {label.color && (
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: label.color }}
                    />
                  )}
                  {label.title}
                </label>
              </div>
            ))}
            {labels.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma etiqueta encontrada</p>
            )}
          </div>
        </ScrollArea>
      )}

      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedLabels.map((label) => (
            <Badge key={label} variant="secondary" className="cursor-pointer" onClick={() => toggleLabel(label)}>
              {label} x
            </Badge>
          ))}
        </div>
      )}

      <Button
        onClick={loadConversations}
        disabled={selectedLabels.length === 0 || loadingConversations}
        className="w-full"
        variant="secondary"
      >
        {loadingConversations && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Filtrar Conversas por Etiquetas
      </Button>
    </div>
  );
}

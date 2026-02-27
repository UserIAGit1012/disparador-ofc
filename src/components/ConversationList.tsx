"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/types";

interface Props {
  conversations: Conversation[];
  onToggle: (conversationId: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export default function ConversationList({
  conversations,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: Props) {
  const selectedCount = conversations.filter((c) => c.selected).length;

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhuma conversa carregada.</p>
        <p className="text-sm">Use o Kanban ou Etiquetas para carregar conversas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {selectedCount} de {conversations.length} conversas selecionadas
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            Selecionar Todas
          </Button>
          <Button variant="outline" size="sm" onClick={onDeselectAll}>
            Desmarcar Todas
          </Button>
        </div>
      </div>

      <ScrollArea className="h-64 rounded-md border">
        <div className="p-3 space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
              onClick={() => onToggle(conv.id)}
            >
              <Checkbox
                checked={conv.selected || false}
                onCheckedChange={() => onToggle(conv.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {conv.contact?.name || `Conversa #${conv.id}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {conv.contact?.phone_number || "Sem numero"} - ID: {conv.id}
                  {conv.last_activity_at && (
                    <span className="ml-2">
                      | Atividade: {new Date(
                        typeof conv.last_activity_at === "number"
                          ? conv.last_activity_at < 1e12
                            ? conv.last_activity_at * 1000
                            : conv.last_activity_at
                          : conv.last_activity_at
                      ).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-1">
                {conv.labels?.slice(0, 2).map((label) => (
                  <Badge key={label} variant="outline" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

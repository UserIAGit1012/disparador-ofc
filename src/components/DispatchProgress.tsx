"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface LogEntry {
  timestamp: string;
  message: string;
  type: "info" | "error" | "success";
}

interface Props {
  sent: number;
  total: number;
  logs: LogEntry[];
  isDone: boolean;
  onCancel: () => void;
  onClose: () => void;
}

export default function DispatchProgress({
  sent,
  total,
  logs,
  isDone,
  onCancel,
  onClose,
}: Props) {
  const percentage = total > 0 ? Math.round((sent / total) * 100) : 0;

  return (
    <div className="space-y-4 rounded-lg border p-4 bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Progresso do Disparo</h3>
        <div className="flex items-center gap-2">
          {!isDone && (
            <Button variant="destructive" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          {isDone && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>{sent} / {total} mensagens</span>
          <Badge variant={isDone ? "default" : "secondary"}>
            {isDone ? "Concluido" : `${percentage}%`}
          </Badge>
        </div>
        <Progress value={percentage} />
      </div>

      <ScrollArea className="h-40 rounded border bg-muted/30 p-2">
        <div className="space-y-1">
          {logs.map((log, i) => (
            <p
              key={i}
              className={`text-xs font-mono ${
                log.type === "error"
                  ? "text-destructive"
                  : log.type === "success"
                  ? "text-green-600"
                  : "text-muted-foreground"
              }`}
            >
              [{log.timestamp}] {log.message}
            </p>
          ))}
          {logs.length === 0 && (
            <p className="text-xs text-muted-foreground">Aguardando inicio do disparo...</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

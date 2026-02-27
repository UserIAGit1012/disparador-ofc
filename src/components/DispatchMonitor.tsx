"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { formatUsd, formatBrl, usdToBrl } from "@/lib/costs";
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import type { DispatchMessage } from "@/types";

interface Props {
  dispatchId: string;
  onBack?: () => void;
}

interface DispatchStatus {
  id: string;
  status: string;
  total_conversations: number;
  sent_count: number;
  error_count: number;
  pending_count: number;
  estimated_cost_usd: number;
  template_name: string;
  created_at: string;
  updated_at: string;
}

export default function DispatchMonitor({ dispatchId, onBack }: Props) {
  const [status, setStatus] = useState<DispatchStatus | null>(null);
  const [messages, setMessages] = useState<DispatchMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDone = status?.status === "completed" || status?.status === "cancelled";

  const triggerStartRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusData, messagesData] = await Promise.all([
        api.getDispatchStatus(dispatchId),
        api.getDispatchMessages(dispatchId),
      ]);
      setStatus(statusData);
      setMessages(messagesData);

      // Auto-trigger: if dispatch is scheduled and time has passed, start it
      if (
        statusData.status === "scheduled" &&
        !triggerStartRef.current
      ) {
        triggerStartRef.current = true;
        api.startDispatch(dispatchId).catch(console.error);
      }

      // Also trigger if status is pending (just created, needs to start processing)
      if (
        statusData.status === "pending" &&
        statusData.pending_count > 0 &&
        !triggerStartRef.current
      ) {
        triggerStartRef.current = true;
        api.startDispatch(dispatchId).catch(console.error);
      }
    } catch (err) {
      console.error("Failed to fetch dispatch status:", err);
    } finally {
      setLoading(false);
    }
  }, [dispatchId]);

  useEffect(() => {
    fetchData();

    intervalRef.current = setInterval(() => {
      fetchData();
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  // Stop polling when done
  useEffect(() => {
    if (isDone && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isDone]);

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Disparo nao encontrado.</p>
        {onBack && (
          <Button variant="outline" onClick={onBack} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        )}
      </div>
    );
  }

  const total = status.total_conversations;
  const processed = status.sent_count + status.error_count;
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  const sentMessages = messages.filter((m) => m.status === "sent");
  const errorMessages = messages.filter((m) => m.status === "error");

  const statusLabel: Record<string, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { text: "Pendente", variant: "secondary" },
    running: { text: "Enviando...", variant: "default" },
    completed: { text: "Concluido", variant: "outline" },
    cancelled: { text: "Cancelado", variant: "destructive" },
    scheduled: { text: "Agendado", variant: "secondary" },
  };

  const current = statusLabel[status.status] || { text: status.status, variant: "secondary" as const };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Overview
        </Button>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Monitoramento do Disparo</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={current.variant}>{current.text}</Badge>
              {!isDone && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <p className="text-2xl font-bold text-green-600">{status.sent_count}</p>
              <p className="text-xs text-muted-foreground">Enviadas</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-destructive/10">
              <p className="text-2xl font-bold text-destructive">{status.error_count}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-500/10">
              <p className="text-2xl font-bold text-yellow-600">{status.pending_count}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{processed} / {total} processadas</span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <Progress value={percentage} />
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Template: <span className="font-medium text-foreground">{status.template_name}</span></span>
            {status.estimated_cost_usd > 0 && (
              <span>
                Custo: {formatUsd(status.estimated_cost_usd)} ({formatBrl(usdToBrl(status.estimated_cost_usd))})
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Messages log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Log de Mensagens</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 rounded border bg-muted/30">
            <div className="p-3 space-y-1">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aguardando mensagens...
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-center gap-2 text-xs font-mono py-1 px-2 rounded hover:bg-muted/50"
                  >
                    {msg.status === "sent" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                    ) : msg.status === "error" ? (
                      <XCircle className="h-3 w-3 text-destructive shrink-0" />
                    ) : (
                      <Clock className="h-3 w-3 text-yellow-600 shrink-0" />
                    )}
                    <span className="truncate flex-1">
                      {msg.contact_name || `Conv #${msg.conversation_id}`}
                      {msg.contact_phone && ` (${msg.contact_phone})`}
                    </span>
                    {msg.status === "error" && msg.error_message && (
                      <span className="text-destructive truncate max-w-[200px]">
                        {msg.error_message}
                      </span>
                    )}
                    {msg.sent_at && (
                      <span className="text-muted-foreground shrink-0">
                        {new Date(msg.sent_at).toLocaleTimeString("pt-BR")}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

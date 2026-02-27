"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { formatUsd, formatBrl, usdToBrl } from "@/lib/costs";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Pause,
  Play,
  Ban,
} from "lucide-react";
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

const POLL_INTERVAL = 3000;
const STALE_THRESHOLD_MS = 15000; // 15s — fallback re-trigger if server self-chain fails

export default function DispatchMonitor({ dispatchId, onBack }: Props) {
  const [status, setStatus] = useState<DispatchStatus | null>(null);
  const [messages, setMessages] = useState<DispatchMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingRef = useRef(false); // Prevents concurrent /start calls
  const userActionRef = useRef(false); // Blocks auto-resume after user pause/cancel

  const isDone =
    status?.status === "completed" || status?.status === "cancelled";
  const isPaused = status?.status === "paused";
  const isRunning = status?.status === "running";

  const triggerStart = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      await api.startDispatch(dispatchId);
    } catch (err) {
      console.error("Failed to trigger /start:", err);
    } finally {
      // Allow re-triggering after a cooldown
      setTimeout(() => {
        startingRef.current = false;
      }, 2000);
    }
  }, [dispatchId]);

  const fetchData = useCallback(async () => {
    // Fetch status and messages INDEPENDENTLY (if one fails, the other still updates)
    let statusData: DispatchStatus | null = null;
    try {
      statusData = await api.getDispatchStatus(dispatchId);
      setStatus(statusData);
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }

    try {
      const messagesData = await api.getDispatchMessages(dispatchId);
      setMessages(messagesData);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }

    // Auto-resume logic (only if status was fetched successfully)
    if (statusData && !userActionRef.current) {
      // Auto-trigger start for scheduled/pending dispatches
      if (
        (statusData.status === "scheduled" || statusData.status === "pending") &&
        statusData.pending_count > 0
      ) {
        triggerStart();
      }

      // Auto-resume: if dispatch is "running" but updated_at is stale and there are pending messages
      if (
        statusData.status === "running" &&
        statusData.pending_count > 0 &&
        statusData.updated_at
      ) {
        const updatedAt = new Date(statusData.updated_at).getTime();
        const staleSince = Date.now() - updatedAt;
        if (staleSince > STALE_THRESHOLD_MS) {
          console.log(
            `Dispatch stale for ${Math.round(staleSince / 1000)}s, re-triggering /start`
          );
          triggerStart();
        }
      }
    }

    setLoading(false);
  }, [dispatchId, triggerStart]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL);
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

  // --- Control Actions ---
  const handlePause = async () => {
    userActionRef.current = true;
    setActionLoading("pause");
    setActionError(null);
    try {
      await api.pauseDispatch(dispatchId);
      setStatus((prev) => prev ? { ...prev, status: "paused" } : prev);
      // Delayed fetch so optimistic update isn't overwritten
      setTimeout(() => fetchData(), 2000);
    } catch (err: any) {
      setActionError(`Falha ao pausar: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Cancelar este disparo? Mensagens pendentes nao serao enviadas.")) return;
    userActionRef.current = true;
    setActionLoading("cancel");
    setActionError(null);
    try {
      await api.cancelDispatch(dispatchId);
      // Optimistic update — show cancelled immediately
      setStatus((prev) => prev ? { ...prev, status: "cancelled", pending_count: 0 } : prev);
      // Stop polling — don't fetchData (would overwrite optimistic update)
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Delayed fetch to sync final counts from DB
      setTimeout(async () => {
        try {
          const [s, m] = await Promise.all([
            api.getDispatchStatus(dispatchId),
            api.getDispatchMessages(dispatchId),
          ]);
          setStatus(s);
          setMessages(m);
        } catch {}
      }, 2000);
    } catch (err: any) {
      setActionError(`Falha ao cancelar: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    userActionRef.current = false;
    setActionLoading("resume");
    setActionError(null);
    try {
      await api.resumeDispatch(dispatchId);
      setStatus((prev) => prev ? { ...prev, status: "running" } : prev);
      triggerStart();
      await fetchData();
    } catch (err: any) {
      setActionError(`Falha ao retomar: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

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

  const statusLabel: Record<
    string,
    { text: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    pending: { text: "Pendente", variant: "secondary" },
    running: { text: "Enviando...", variant: "default" },
    completed: { text: "Concluido", variant: "outline" },
    cancelled: { text: "Cancelado", variant: "destructive" },
    scheduled: { text: "Agendado", variant: "secondary" },
    paused: { text: "Pausado", variant: "secondary" },
  };

  const current = statusLabel[status.status] || {
    text: status.status,
    variant: "secondary" as const,
  };

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
              {!isDone && !isPaused && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <p className="text-2xl font-bold text-green-600">
                {status.sent_count}
              </p>
              <p className="text-xs text-muted-foreground">Enviadas</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-destructive/10">
              <p className="text-2xl font-bold text-destructive">
                {status.error_count}
              </p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-500/10">
              <p className="text-2xl font-bold text-yellow-600">
                {status.pending_count}
              </p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>
                {processed} / {total} processadas
              </span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <Progress value={percentage} />
          </div>

          {/* Template & cost info */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Template:{" "}
              <span className="font-medium text-foreground">
                {status.template_name}
              </span>
            </span>
            {status.estimated_cost_usd > 0 && (
              <span>
                Custo: {formatUsd(status.estimated_cost_usd)} (
                {formatBrl(usdToBrl(status.estimated_cost_usd))})
              </span>
            )}
          </div>

          {/* Error message */}
          {actionError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {actionError}
            </div>
          )}

          {/* Control buttons */}
          {!isDone && (
            <div className="flex items-center gap-2 pt-2 border-t">
              {isRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePause}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "pause" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Pause className="mr-2 h-4 w-4" />
                  )}
                  Pausar
                </Button>
              )}
              {isPaused && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResume}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "resume" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Retomar
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={!!actionLoading}
              >
                {actionLoading === "cancel" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="mr-2 h-4 w-4" />
                )}
                Cancelar Disparo
              </Button>
            </div>
          )}
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
                    ) : msg.status === "cancelled" ? (
                      <Ban className="h-3 w-3 text-muted-foreground shrink-0" />
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
                    {msg.status === "cancelled" && (
                      <span className="text-muted-foreground">cancelado</span>
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

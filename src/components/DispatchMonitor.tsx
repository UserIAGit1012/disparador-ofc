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
  Trash2,
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

export default function DispatchMonitor({ dispatchId, onBack }: Props) {
  const [status, setStatus] = useState<DispatchStatus | null>(null);
  const [messages, setMessages] = useState<DispatchMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendLoopErrors, setSendLoopErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const abortRef = useRef(false);
  const sendLoopRunningRef = useRef(false);
  const messagesIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track if cancel was requested — prevents sendLoop from restarting
  const cancelledRef = useRef(false);

  const isDone =
    status?.status === "completed" || status?.status === "cancelled";
  const isPaused = status?.status === "paused";
  const isRunning = status?.status === "running";

  // Fetch full status + messages (for initial load and final sync)
  const fetchFullStatus = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        api.getDispatchStatus(dispatchId),
        api.getDispatchMessages(dispatchId),
      ]);
      setStatus(s);
      setMessages(m);
      return s;
    } catch (err) {
      console.error("Failed to fetch status:", err);
      return null;
    }
  }, [dispatchId]);

  // Fetch only messages (for periodic log refresh during send loop)
  const fetchMessages = useCallback(async () => {
    try {
      const m = await api.getDispatchMessages(dispatchId);
      setMessages(m);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  }, [dispatchId]);

  // Start periodic message log refresh
  const startMessagePolling = useCallback(() => {
    if (messagesIntervalRef.current) return;
    messagesIntervalRef.current = setInterval(fetchMessages, 5000);
  }, [fetchMessages]);

  // Stop periodic message log refresh
  const stopMessagePolling = useCallback(() => {
    if (messagesIntervalRef.current) {
      clearInterval(messagesIntervalRef.current);
      messagesIntervalRef.current = null;
    }
  }, []);

  // ---- Browser-Driven Send Loop ----
  const sendLoop = useCallback(async () => {
    if (sendLoopRunningRef.current) return;
    if (cancelledRef.current) return; // Don't start if already cancelled

    sendLoopRunningRef.current = true;
    setSending(true);
    setSendLoopErrors([]);
    abortRef.current = false;

    // NOTE: No resumeDispatch() call here!
    // The send-next endpoint handles pending→running transition atomically.

    startMessagePolling();

    let consecutiveErrors = 0;

    while (!abortRef.current) {
      try {
        const result = await api.sendNext(dispatchId);

        // If abort was set during the API call, don't update status
        if (abortRef.current) break;

        // Update status from result immediately (real-time counts)
        setStatus((prev) => {
          if (!prev) return prev;
          if (result.done) {
            return {
              ...prev,
              sent_count: result.sent_count,
              error_count: result.error_count,
              pending_count: result.remaining,
              status: result.reason === 'completed' ? 'completed' :
                      result.reason === 'stopped' ? prev.status : prev.status,
            };
          }
          return {
            ...prev,
            sent_count: result.sent_count,
            error_count: result.error_count,
            pending_count: result.remaining,
            status: 'running',
          };
        });

        consecutiveErrors = 0;

        if (result.done) break;

        if (result.waiting) {
          await sleep(3000);
          continue;
        }

        // Delay between messages (happens in the BROWSER, not server)
        const delay = randomDelay(result.delay_min, result.delay_max);
        await sleep(delay);
      } catch (err: any) {
        if (abortRef.current) break;
        console.error("sendNext error:", err);
        consecutiveErrors++;

        const timestamp = new Date().toLocaleTimeString("pt-BR");
        const errorMsg = `[${timestamp}] Erro #${consecutiveErrors}: ${err.message || 'Erro desconhecido'}`;
        setSendLoopErrors((prev) => [...prev.slice(-9), errorMsg]);

        if (consecutiveErrors >= 3) {
          setSendLoopErrors((prev) => [
            ...prev,
            `[${timestamp}] Loop parado apos ${consecutiveErrors} erros consecutivos. Verifique a conexao e tente retomar.`,
          ]);
          // Fetch messages to show any per-message errors
          await fetchMessages();
          break;
        }

        await sleep(2000);
      }
    }

    stopMessagePolling();
    setSending(false);
    sendLoopRunningRef.current = false;

    // Fetch final state (only if not cancelled by user — cancel does its own fetch)
    if (!cancelledRef.current) {
      await fetchFullStatus();
    }
  }, [dispatchId, fetchFullStatus, fetchMessages, startMessagePolling, stopMessagePolling]);

  // ---- Initial Load ----
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const s = await fetchFullStatus();
      setLoading(false);

      if (cancelled) return;

      // Auto-start send loop ONLY for active dispatches with pending messages
      if (
        s &&
        ['pending', 'scheduled', 'running'].includes(s.status) &&
        s.pending_count > 0
      ) {
        sendLoop();
      }
    }

    init();

    return () => {
      cancelled = true;
      abortRef.current = true;
      stopMessagePolling();
    };
  }, [fetchFullStatus, sendLoop, stopMessagePolling]);

  // ---- Control Actions ----
  const handlePause = async () => {
    abortRef.current = true; // Stop the send loop IMMEDIATELY
    setActionLoading("pause");
    setActionError(null);
    try {
      await api.pauseDispatch(dispatchId);
      setStatus((prev) => (prev ? { ...prev, status: "paused" } : prev));
      setTimeout(() => fetchFullStatus(), 1000);
    } catch (err: any) {
      setActionError(`Falha ao pausar: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (
      !window.confirm(
        "Cancelar este disparo? Mensagens pendentes nao serao enviadas."
      )
    )
      return;

    // Stop the send loop IMMEDIATELY and prevent restart
    abortRef.current = true;
    cancelledRef.current = true;
    setActionLoading("cancel");
    setActionError(null);
    try {
      await api.cancelDispatch(dispatchId);
      // Optimistic update
      setStatus((prev) =>
        prev ? { ...prev, status: "cancelled", pending_count: 0 } : prev
      );
      // Sync final state after DB settles
      setTimeout(async () => {
        const s = await fetchFullStatus();
        // If somehow status isn't cancelled, force it
        if (s && s.status !== "cancelled") {
          try {
            await api.cancelDispatch(dispatchId);
            await fetchFullStatus();
          } catch {}
        }
      }, 1500);
    } catch (err: any) {
      setActionError(`Falha ao cancelar: ${err.message}`);
      cancelledRef.current = false; // Allow retry
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    setActionLoading("resume");
    setActionError(null);
    try {
      await api.resumeDispatch(dispatchId);
      // Fetch real counts from server before restarting loop (prevents counter reset)
      await fetchFullStatus();
      // Reset cancel flag and restart loop
      cancelledRef.current = false;
      abortRef.current = false;
      sendLoop();
    } catch (err: any) {
      setActionError(`Falha ao retomar: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Excluir este disparo permanentemente? Esta acao nao pode ser desfeita."
      )
    )
      return;

    abortRef.current = true;
    cancelledRef.current = true;
    setActionLoading("delete");
    setActionError(null);
    try {
      await api.deleteDispatch(dispatchId);
      // Navigate back
      if (onBack) onBack();
    } catch (err: any) {
      setActionError(`Falha ao excluir: ${err.message}`);
      cancelledRef.current = false;
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
    {
      text: string;
      variant: "default" | "secondary" | "destructive" | "outline";
    }
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
            <CardTitle className="text-lg">
              Monitoramento do Disparo
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={current.variant}>{current.text}</Badge>
              {sending && !isDone && !isPaused && (
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

          {/* Action error message */}
          {actionError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {actionError}
            </div>
          )}

          {/* Send loop errors */}
          {sendLoopErrors.length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1">
              <p className="text-sm font-medium text-destructive">Erros no envio:</p>
              {sendLoopErrors.map((err, i) => (
                <p key={i} className="text-xs text-destructive/90 font-mono break-words whitespace-pre-wrap">
                  {err}
                </p>
              ))}
            </div>
          )}

          {/* Control buttons */}
          <div className="flex items-center gap-2 pt-2 border-t">
            {!isDone && (
              <>
                {(isRunning || sending) && (
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
                {isPaused && !sending && (
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
              </>
            )}
            {/* Delete button — always visible */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={!!actionLoading}
              className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {actionLoading === "delete" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Excluir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Messages log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Log de Mensagens</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchMessages}>
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
                    className="text-xs font-mono py-1 px-2 rounded hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
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
                      {msg.status === "cancelled" && (
                        <span className="text-muted-foreground">cancelado</span>
                      )}
                      {msg.sent_at && (
                        <span className="text-muted-foreground shrink-0">
                          {new Date(msg.sent_at).toLocaleTimeString("pt-BR")}
                        </span>
                      )}
                    </div>
                    {msg.status === "error" && msg.error_message && (
                      <div className="mt-1 ml-5 text-destructive bg-destructive/5 rounded px-2 py-1 break-words whitespace-pre-wrap">
                        {msg.error_message}
                      </div>
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

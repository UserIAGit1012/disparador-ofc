"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { formatUsd, formatBrl, usdToBrl } from "@/lib/costs";
import { getSupabase } from "@/lib/supabase";
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
  Radio,
  Filter,
  Send,
  AlertTriangle,
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

type LogFilter = "all" | "sent" | "error" | "pending" | "sending";

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
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [autoScroll, setAutoScroll] = useState(true);

  const abortRef = useRef(false);
  const sendLoopRunningRef = useRef(false);
  const messagesIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isDone =
    status?.status === "completed" || status?.status === "cancelled";
  const isPaused = status?.status === "paused";
  const isRunning = status?.status === "running";

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // ---- Supabase Realtime Subscription ----
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    // Subscribe to dispatch_messages changes for this dispatch
    const messagesChannel = supabase
      .channel(`dispatch-messages-${dispatchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dispatch_messages",
          filter: `dispatch_id=eq.${dispatchId}`,
        },
        (payload) => {
          const newRecord = payload.new as any;
          if (!newRecord || !newRecord.id) return;

          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === newRecord.id);
            const updated: DispatchMessage = {
              id: newRecord.id,
              dispatch_id: newRecord.dispatch_id,
              conversation_id: newRecord.conversation_id,
              contact_name: newRecord.contact_name,
              contact_phone: newRecord.contact_phone,
              template_name: newRecord.template_name,
              template_category: newRecord.template_category,
              status: newRecord.status,
              error_message: newRecord.error_message || undefined,
              cost_usd: newRecord.cost_usd ? parseFloat(newRecord.cost_usd) : undefined,
              sent_at: newRecord.sent_at || undefined,
              created_at: newRecord.created_at || "",
            };

            if (idx >= 0) {
              // Update existing message
              const next = [...prev];
              next[idx] = updated;
              return next;
            }
            // New message (INSERT event)
            return [...prev, updated];
          });

          // Update counts from realtime message status changes
          if (newRecord.status === "sent" || newRecord.status === "error") {
            setStatus((prev) => {
              if (!prev) return prev;
              // Recalculate from messages for accuracy
              return prev; // Let the send loop handle counts; this prevents race conditions
            });
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    // Subscribe to dispatch status changes
    const dispatchChannel = supabase
      .channel(`dispatch-status-${dispatchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dispatches",
          filter: `id=eq.${dispatchId}`,
        },
        (payload) => {
          const newRecord = payload.new as any;
          if (!newRecord) return;

          setStatus((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: newRecord.status || prev.status,
              sent_count: newRecord.sent_count ?? prev.sent_count,
              error_count: newRecord.error_count ?? prev.error_count,
              estimated_cost_usd: newRecord.estimated_cost_usd ?? prev.estimated_cost_usd,
              updated_at: newRecord.updated_at || prev.updated_at,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(dispatchChannel);
    };
  }, [dispatchId]);

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

  // Fetch only messages (fallback polling when realtime not connected)
  const fetchMessages = useCallback(async () => {
    try {
      const m = await api.getDispatchMessages(dispatchId);
      setMessages(m);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  }, [dispatchId]);

  // Fallback polling only when realtime is NOT connected
  const startMessagePolling = useCallback(() => {
    if (messagesIntervalRef.current) return;
    // Only poll if realtime isn't working — 3s fallback
    messagesIntervalRef.current = setInterval(() => {
      if (!realtimeConnected) {
        fetchMessages();
      }
    }, 3000);
  }, [fetchMessages, realtimeConnected]);

  const stopMessagePolling = useCallback(() => {
    if (messagesIntervalRef.current) {
      clearInterval(messagesIntervalRef.current);
      messagesIntervalRef.current = null;
    }
  }, []);

  // ---- Browser-Driven Send Loop ----
  const sendLoop = useCallback(async () => {
    if (sendLoopRunningRef.current) return;
    if (cancelledRef.current) return;

    sendLoopRunningRef.current = true;
    setSending(true);
    setSendLoopErrors([]);
    abortRef.current = false;

    startMessagePolling();

    let consecutiveErrors = 0;

    while (!abortRef.current) {
      try {
        const result = await api.sendNext(dispatchId);

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

        // Update message log from API response (immediate, before Realtime delivers)
        if (result.message) {
          const processedMsg = result.message;
          setMessages((prev) => {
            const exists = prev.find((m) => m.id === processedMsg.id);
            if (exists) {
              return prev.map((m) =>
                m.id === processedMsg.id
                  ? {
                      ...m,
                      status: processedMsg.status,
                      error_message: processedMsg.error_message || undefined,
                      sent_at: processedMsg.sent_at || undefined,
                    }
                  : m
              );
            }
            return [
              ...prev,
              {
                id: processedMsg.id,
                dispatch_id: processedMsg.dispatch_id,
                conversation_id: processedMsg.conversation_id,
                contact_name: processedMsg.contact_name,
                contact_phone: processedMsg.contact_phone,
                template_name: processedMsg.template_name,
                status: processedMsg.status,
                error_message: processedMsg.error_message || undefined,
                sent_at: processedMsg.sent_at || undefined,
                created_at: '',
              },
            ];
          });
        }

        consecutiveErrors = 0;

        if (result.done) break;

        if (result.waiting) {
          await sleep(3000);
          continue;
        }

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
          await fetchMessages();
          break;
        }

        await sleep(2000);
      }
    }

    stopMessagePolling();
    setSending(false);
    sendLoopRunningRef.current = false;

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
    abortRef.current = true;
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

    abortRef.current = true;
    cancelledRef.current = true;
    setActionLoading("cancel");
    setActionError(null);
    try {
      await api.cancelDispatch(dispatchId);
      setStatus((prev) =>
        prev ? { ...prev, status: "cancelled", pending_count: 0 } : prev
      );
      setTimeout(async () => {
        const s = await fetchFullStatus();
        if (s && s.status !== "cancelled") {
          try {
            await api.cancelDispatch(dispatchId);
            await fetchFullStatus();
          } catch {}
        }
      }, 1500);
    } catch (err: any) {
      setActionError(`Falha ao cancelar: ${err.message}`);
      cancelledRef.current = false;
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    setActionLoading("resume");
    setActionError(null);
    try {
      await api.resumeDispatch(dispatchId);
      await fetchFullStatus();
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
      if (onBack) onBack();
    } catch (err: any) {
      setActionError(`Falha ao excluir: ${err.message}`);
      cancelledRef.current = false;
    } finally {
      setActionLoading(null);
    }
  };

  // ---- Filter messages ----
  const filteredMessages = messages.filter((msg) => {
    if (logFilter === "all") return true;
    if (logFilter === "sending") return msg.status === "sending";
    return msg.status === logFilter;
  });

  // Count by status for filter badges
  const countByStatus = {
    sent: messages.filter((m) => m.status === "sent").length,
    error: messages.filter((m) => m.status === "error").length,
    pending: messages.filter((m) => m.status === "pending" || m.status === "sending").length,
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

      {/* Messages log — Real-time */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Log de Mensagens</CardTitle>
              {/* Realtime indicator */}
              {realtimeConnected ? (
                <span className="flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                  <Radio className="h-3 w-3 animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-medium text-yellow-600 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                  <Clock className="h-3 w-3" />
                  POLLING
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={fetchMessages}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-1.5 mt-2">
            <Button
              variant={logFilter === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setLogFilter("all")}
            >
              <Filter className="h-3 w-3 mr-1" />
              Todos ({messages.length})
            </Button>
            <Button
              variant={logFilter === "sent" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setLogFilter("sent")}
            >
              <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
              Enviados ({countByStatus.sent})
            </Button>
            <Button
              variant={logFilter === "error" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setLogFilter("error")}
            >
              <XCircle className="h-3 w-3 mr-1 text-destructive" />
              Erros ({countByStatus.error})
            </Button>
            <Button
              variant={logFilter === "pending" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setLogFilter("pending")}
            >
              <Clock className="h-3 w-3 mr-1 text-yellow-600" />
              Pendentes ({countByStatus.pending})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className="h-80 rounded border bg-muted/30 overflow-y-auto"
            ref={scrollContainerRef}
            onScroll={handleScroll}
          >
            <div className="p-3 space-y-0.5">
              {filteredMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {messages.length === 0
                    ? "Aguardando mensagens..."
                    : `Nenhuma mensagem com filtro "${logFilter}"`}
                </p>
              ) : (
                filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`text-xs font-mono py-1.5 px-2.5 rounded transition-colors ${
                      msg.status === "sent"
                        ? "bg-green-500/5 hover:bg-green-500/10 border-l-2 border-green-500"
                        : msg.status === "error"
                        ? "bg-destructive/5 hover:bg-destructive/10 border-l-2 border-destructive"
                        : msg.status === "sending"
                        ? "bg-blue-500/5 hover:bg-blue-500/10 border-l-2 border-blue-500"
                        : msg.status === "cancelled"
                        ? "bg-muted/30 hover:bg-muted/50 border-l-2 border-muted-foreground/30"
                        : "hover:bg-muted/50 border-l-2 border-yellow-500/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Status icon */}
                      {msg.status === "sent" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      ) : msg.status === "error" ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      ) : msg.status === "sending" ? (
                        <Send className="h-3.5 w-3.5 text-blue-500 shrink-0 animate-pulse" />
                      ) : msg.status === "cancelled" ? (
                        <Ban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
                      )}

                      {/* Status badge */}
                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          msg.status === "sent"
                            ? "text-green-700 bg-green-500/15"
                            : msg.status === "error"
                            ? "text-destructive bg-destructive/10"
                            : msg.status === "sending"
                            ? "text-blue-600 bg-blue-500/15"
                            : msg.status === "cancelled"
                            ? "text-muted-foreground bg-muted"
                            : "text-yellow-700 bg-yellow-500/15"
                        }`}
                      >
                        {msg.status === "sent"
                          ? "ENVIADO"
                          : msg.status === "error"
                          ? "ERRO"
                          : msg.status === "sending"
                          ? "ENVIANDO"
                          : msg.status === "cancelled"
                          ? "CANCELADO"
                          : "PENDENTE"}
                      </span>

                      {/* Contact info */}
                      <span className="truncate flex-1 font-medium">
                        {msg.contact_name || `Conv #${msg.conversation_id}`}
                      </span>

                      {/* Phone */}
                      {msg.contact_phone && (
                        <span className="text-muted-foreground text-[10px] shrink-0">
                          {msg.contact_phone}
                        </span>
                      )}

                      {/* Timestamp */}
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {msg.sent_at
                          ? new Date(msg.sent_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })
                          : msg.created_at
                          ? new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })
                          : "--:--:--"}
                      </span>
                    </div>

                    {/* Error details */}
                    {msg.status === "error" && msg.error_message && (
                      <div className="mt-1.5 ml-6 flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                        <span className="text-destructive/90 bg-destructive/5 rounded px-2 py-1 break-words whitespace-pre-wrap text-[11px] leading-relaxed flex-1">
                          {msg.error_message}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Auto-scroll indicator */}
          {!autoScroll && filteredMessages.length > 0 && (
            <div className="flex justify-center mt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => {
                  setAutoScroll(true);
                  logEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Ir para o final
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { formatUsd, formatBrl, usdToBrl } from "@/lib/costs";
import {
  Send,
  AlertTriangle,
  DollarSign,
  Plus,
  Eye,
  Loader2,
  Clock,
  RefreshCw,
} from "lucide-react";
import type { DashboardStats, DispatchRecord } from "@/types";

interface Props {
  accountId: number;
  accountName?: string;
  onNewDispatch: () => void;
  onMonitorDispatch: (dispatchId: string) => void;
}

export default function AccountOverview({
  accountId,
  accountName,
  onNewDispatch,
  onMonitorDispatch,
}: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load stats for current month
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const statsData = await api.getDashboardStats(accountId, month);
      setStats(statsData);

      // Load recent dispatches from Supabase
      const sb = getSupabase();
      if (sb) {
        const { data } = await sb
          .from("dispatches")
          .select("*")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false })
          .limit(20);
        setDispatches((data as DispatchRecord[]) || []);
      }
    } catch (err) {
      console.error("Failed to load account overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [accountId]);

  const activeDispatches = dispatches.filter(
    (d) => d.status === "running" || d.status === "pending" || d.status === "paused"
  );
  const scheduledDispatches = dispatches.filter((d) => d.status === "scheduled");
  const recentDispatches = dispatches.filter(
    (d) => d.status === "completed" || d.status === "cancelled"
  ).slice(0, 10);

  const statusBadge = (status: string) => {
    const map: Record<string, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      running: { text: "Enviando", variant: "default" },
      pending: { text: "Pendente", variant: "secondary" },
      paused: { text: "Pausado", variant: "secondary" },
      scheduled: { text: "Agendado", variant: "secondary" },
      completed: { text: "Concluido", variant: "outline" },
      cancelled: { text: "Cancelado", variant: "destructive" },
    };
    const s = map[status] || { text: status, variant: "secondary" as const };
    return <Badge variant={s.variant}>{s.text}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {accountName || `Conta #${accountId}`}
          </h2>
          <p className="text-muted-foreground">Overview do mes atual</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button onClick={onNewDispatch}>
            <Plus className="mr-2 h-4 w-4" /> Novo Disparo
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Send className="h-4 w-4" />
              Enviadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {(stats?.totalSent || 0).toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Erros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {(stats?.totalErrors || 0).toLocaleString("pt-BR")}
            </p>
            {stats && stats.errorRate > 0 && (
              <p className="text-xs text-muted-foreground">{stats.errorRate.toFixed(1)}%</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Custo USD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatUsd(stats?.totalCostUsd || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Custo BRL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatBrl(usdToBrl(stats?.totalCostUsd || 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Dispatches */}
      {activeDispatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Disparos Ativos ({activeDispatches.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeDispatches.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => onMonitorDispatch(d.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.template_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.sent_count}/{d.total_conversations} enviadas
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(d.status)}
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scheduled Dispatches */}
      {scheduledDispatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Disparos Agendados ({scheduledDispatches.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scheduledDispatches.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => onMonitorDispatch(d.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.template_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Agendado para:{" "}
                      {d.scheduled_at
                        ? new Date(d.scheduled_at).toLocaleString("pt-BR")
                        : "—"}{" "}
                      | {d.total_conversations} contatos
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(d.status)}
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Dispatches */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historico Recente</CardTitle>
        </CardHeader>
        <CardContent>
          {recentDispatches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum disparo recente.
            </p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {recentDispatches.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => onMonitorDispatch(d.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.template_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleString("pt-BR")} |{" "}
                        {d.sent_count} enviadas, {d.error_count} erros |{" "}
                        {formatUsd(d.estimated_cost_usd || 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(d.status)}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

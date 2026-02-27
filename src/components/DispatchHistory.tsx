"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccount } from "@/components/AccountProvider";
import { getSupabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/costs";
import { RefreshCw, RotateCcw, Clock, Loader2 } from "lucide-react";
import type { DispatchRecord } from "@/types";

export default function DispatchHistory() {
  const { accountId } = useAccount();
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadDispatches = async () => {
    setLoading(true);
    const sb = getSupabase();
    if (sb) {
      let query = sb
        .from("dispatches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (accountId) {
        query = query.eq("account_id", accountId);
      }
      const { data, error } = await query;
      if (!error && data) setDispatches(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDispatches();
  }, [accountId]);

  const handleRetry = async (dispatchId: string) => {
    setRetrying(dispatchId);
    try {
      const result = await api.retryDispatch(dispatchId);
      alert(`Retry criado com sucesso! ${result.retry_count} mensagens para reenviar.`);
      loadDispatches();
    } catch (err: any) {
      alert(`Erro ao criar retry: ${err.message}`);
    }
    setRetrying(null);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "running": return "secondary";
      case "cancelled": return "destructive";
      case "scheduled": return "outline";
      default: return "outline";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Concluido";
      case "running": return "Em andamento";
      case "cancelled": return "Cancelado";
      case "pending": return "Pendente";
      case "scheduled": return "Agendado";
      default: return status;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Historico de Disparos</h2>
        <Button variant="outline" size="sm" onClick={loadDispatches} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {dispatches.length === 0 && !loading ? (
        <p className="text-center py-8 text-muted-foreground">Nenhum disparo realizado ainda.</p>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {dispatches.map((d) => (
              <div key={d.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{d.template_name}</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {d.id.slice(0, 8)}... | Conta: {d.account_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.status === "scheduled" && d.scheduled_at && (
                      <Badge variant="outline" className="text-blue-600 border-blue-400">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(d.scheduled_at).toLocaleString("pt-BR")}
                      </Badge>
                    )}
                    <Badge variant={statusColor(d.status) as any}>
                      {statusLabel(d.status)}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Total: {d.total_conversations}</span>
                  <span>Enviados: {d.sent_count}</span>
                  {d.error_count > 0 && (
                    <span className="text-destructive">Erros: {d.error_count}</span>
                  )}
                  {d.estimated_cost_usd != null && d.estimated_cost_usd > 0 && (
                    <span>Custo: {formatUsd(d.estimated_cost_usd)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString("pt-BR")}
                  </p>
                  {d.error_count > 0 && (d.status === "completed" || d.status === "cancelled") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(d.id)}
                      disabled={retrying === d.id}
                    >
                      {retrying === d.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3 mr-1" />
                      )}
                      Retry ({d.error_count})
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

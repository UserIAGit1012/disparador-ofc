"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/components/AccountProvider";
import { api } from "@/lib/api";
import { formatUsd, formatBrl, usdToBrl } from "@/lib/costs";
import {
  RefreshCw,
  Send,
  AlertTriangle,
  DollarSign,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import type { DashboardStats } from "@/types";

function buildMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

export default function DashboardMetrics() {
  const { accountId } = useAccount();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  const monthOptions = buildMonthOptions();

  // Load stats when account or month changes
  useEffect(() => {
    if (accountId) {
      loadStats();
    } else {
      setStats(null);
    }
  }, [accountId, selectedMonth]);

  const loadStats = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const data = await api.getDashboardStats(accountId, selectedMonth || undefined);
      setStats(data);
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-1 min-w-[200px]">
          <Label>Mes</Label>
          <Select
            value={selectedMonth}
            onValueChange={setSelectedMonth}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={loadStats} disabled={loading || !accountId}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {!accountId ? (
        <p className="text-center py-12 text-muted-foreground">
          Selecione uma conta no menu acima para visualizar as metricas.
        </p>
      ) : !stats ? (
        <p className="text-center py-8 text-muted-foreground">
          {loading ? "Carregando..." : "Nenhum dado disponivel."}
        </p>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Total Enviadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalSent.toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Total Erros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{stats.totalErrors.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">
                  Taxa de erro: {stats.errorRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Custo Total (USD)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatUsd(stats.totalCostUsd)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Custo Total (BRL)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatBrl(usdToBrl(stats.totalCostUsd))}</p>
              </CardContent>
            </Card>
          </div>

          {/* Sent by Day */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Envios por Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.sentByDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum envio no periodo.</p>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-1">
                    {stats.sentByDay.map((day) => {
                      const maxCount = Math.max(...stats.sentByDay.map((d) => d.count));
                      const widthPct = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                      return (
                        <div key={day.date} className="flex items-center gap-3 text-sm">
                          <span className="w-24 text-muted-foreground shrink-0">
                            {new Date(day.date + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                          <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                            <div
                              className="h-full bg-primary rounded"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                          <span className="w-12 text-right font-medium">{day.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Cost by Month + Top Templates side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Custo por Mes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.costByMonth.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum custo no periodo.</p>
                ) : (
                  <div className="space-y-3">
                    {stats.costByMonth.map((m) => (
                      <div key={m.month} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{m.month}</span>
                          <span>{formatUsd(m.marketing + m.utility)}</span>
                        </div>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">Marketing: {formatUsd(m.marketing)}</Badge>
                          <Badge variant="secondary">Utility: {formatUsd(m.utility)}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Top Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum template usado.</p>
                ) : (
                  <div className="space-y-2">
                    {stats.topTemplates.map((t, i) => (
                      <div key={t.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-5">{i + 1}.</span>
                          <span className="font-medium truncate max-w-[200px]">{t.name}</span>
                        </div>
                        <Badge variant="secondary">{t.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

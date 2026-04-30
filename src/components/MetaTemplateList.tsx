"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Trash2, Building2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

interface MetaTemplate {
  id?: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components?: any[];
  rejected_reason?: string;
  quality_score?: { score?: string };
  waba_id?: string;
  waba_name?: string;
}

interface FlatRow extends MetaTemplate {
  businessId: string;
  businessName: string;
  businessWaba: string;
}

interface Props {
  reloadKey?: number;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  APPROVED: "default",
  PENDING: "secondary",
  REJECTED: "destructive",
  DELETED: "outline",
  PAUSED: "secondary",
  DISABLED: "destructive",
};

export default function MetaTemplateList({ reloadKey }: Props) {
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [groupErrors, setGroupErrors] = useState<{ name: string; error: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [businessFilter, setBusinessFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAllMetaTemplates();
      const flat: FlatRow[] = [];
      const errs: { name: string; error: string }[] = [];
      for (const g of data) {
        if (g.error) errs.push({ name: g.business.name, error: g.error });
        for (const t of g.templates || []) {
          flat.push({
            ...t,
            businessId: g.business.id,
            businessName: g.business.name,
            businessWaba: g.business.business_account_id,
          });
        }
      }
      setRows(flat);
      setGroupErrors(errs);
    } catch (err: any) {
      setError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const businesses = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of rows) set.set(r.businessId, r.businessName);
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (businessFilter !== "all" && r.businessId !== businessFilter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDelete = async (r: FlatRow) => {
    if (
      !confirm(
        `Excluir template "${r.name}" da BM "${r.businessName}"? Acao irreversivel.`
      )
    )
      return;
    try {
      const waba = r.waba_id || r.businessWaba;
      await api.deleteMetaTemplate(r.businessId, r.name, waba, r.id);
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Templates (todas as BMs)</CardTitle>
            <CardDescription>
              {rows.length} template{rows.length !== 1 ? "s" : ""} de{" "}
              {businesses.length} BM{businesses.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Select value={businessFilter} onValueChange={setBusinessFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as BMs</SelectItem>
              {businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="APPROVED">Aprovados</SelectItem>
              <SelectItem value="PENDING">Pendentes</SelectItem>
              <SelectItem value="REJECTED">Rejeitados</SelectItem>
              <SelectItem value="PAUSED">Pausados</SelectItem>
              <SelectItem value="DISABLED">Desabilitados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded p-2 mb-3">
            {error}
          </p>
        )}
        {groupErrors.length > 0 && (
          <div className="mb-3 space-y-1">
            {groupErrors.map((g, i) => (
              <p
                key={i}
                className="text-xs text-amber-700 bg-amber-50 rounded p-2 flex items-start gap-1"
              >
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  <strong>{g.name}</strong>: {g.error}
                </span>
              </p>
            ))}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum template encontrado.
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((t) => {
              const body = t.components?.find((c: any) => c.type === "BODY")?.text;
              return (
                <li
                  key={`${t.businessId}-${t.name}-${t.language}`}
                  className="py-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{t.name}</span>
                      <Badge variant={STATUS_VARIANT[t.status] || "secondary"}>
                        {t.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {t.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {t.language}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Building2 className="h-3 w-3" />
                      {t.businessName}
                      {t.waba_name && (
                        <span className="text-muted-foreground/70">
                          · {t.waba_name}
                        </span>
                      )}
                    </div>
                    {body && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                        {body}
                      </p>
                    )}
                    {t.rejected_reason && (
                      <p className="text-xs text-destructive mt-1">
                        Motivo da rejeicao: {t.rejected_reason}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(t)}
                    title="Excluir template"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

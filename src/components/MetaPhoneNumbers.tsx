"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Phone, Building2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

interface PhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating?: string;
  code_verification_status?: string;
  name_status?: string;
  messaging_limit_tier?: string;
}

interface BusinessGroup {
  business: { id: string; name: string; business_account_id: string };
  numbers: PhoneNumber[];
  error: string | null;
}

const QUALITY_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  GREEN: "default",
  YELLOW: "secondary",
  RED: "destructive",
  UNKNOWN: "secondary",
};

export default function MetaPhoneNumbers() {
  const [groups, setGroups] = useState<BusinessGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAllMetaNumbers();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totalNumbers = groups.reduce((sum, g) => sum + (g.numbers?.length || 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Numeros (todas as BMs)</CardTitle>
          <CardDescription>
            {totalNumbers} numero{totalNumbers !== 1 ? "s" : ""} em {groups.length} BM
            {groups.length !== 1 ? "s" : ""}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded p-2">
            {error}
          </p>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma BM cadastrada. Va na aba "Credenciais" para adicionar.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.business.id} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {g.business.name}
                <Badge variant="outline" className="font-mono text-xs">
                  {g.business.business_account_id}
                </Badge>
              </div>
              {g.error ? (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded p-2 ml-6">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{g.error}</span>
                </div>
              ) : g.numbers.length === 0 ? (
                <p className="text-sm text-muted-foreground ml-6">
                  Nenhum numero ativo nesta BM.
                </p>
              ) : (
                <ul className="ml-6 divide-y rounded-md border">
                  {g.numbers.map((n) => (
                    <li key={n.id} className="py-2.5 px-3 flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm">
                            {n.display_phone_number}
                          </span>
                          {n.quality_rating && (
                            <Badge
                              variant={
                                QUALITY_VARIANTS[n.quality_rating.toUpperCase()] ||
                                "secondary"
                              }
                            >
                              {n.quality_rating}
                            </Badge>
                          )}
                          {n.messaging_limit_tier && (
                            <Badge variant="outline" className="text-xs">
                              {n.messaging_limit_tier}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {n.verified_name}
                          {n.name_status && ` · ${n.name_status}`}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        ID: {n.id}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

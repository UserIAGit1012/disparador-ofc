"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { Inbox } from "@/types";

interface Props {
  accountId: number | null;
  value: number | null;
  onChange: (inboxId: number) => void;
}

export default function InboxSelector({ accountId, value, onChange }: Props) {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId) {
      setInboxes([]);
      return;
    }
    setLoading(true);
    api.getInboxes(accountId)
      .then(setInboxes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [accountId]);

  return (
    <div className="space-y-2">
      <Label>Caixa de Entrada</Label>
      <Select
        value={value?.toString() || ""}
        onValueChange={(v) => onChange(parseInt(v))}
        disabled={!accountId || loading}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Carregando..." : "Selecione a caixa de entrada"} />
        </SelectTrigger>
        <SelectContent>
          {inboxes.map((inbox) => (
            <SelectItem key={inbox.id} value={inbox.id.toString()}>
              {inbox.name} ({inbox.channel_type})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

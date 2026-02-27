"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { Account } from "@/types";

interface Props {
  value: number | null;
  onChange: (accountId: number) => void;
}

export default function AccountSelector({ value, onChange }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAccounts()
      .then(setAccounts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-2">
      <Label>Conta</Label>
      <Select
        value={value?.toString() || ""}
        onValueChange={(v) => onChange(parseInt(v))}
        disabled={loading}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Carregando..." : "Selecione a conta"} />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id.toString()}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

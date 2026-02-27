"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";

export type ActivityFilterValue = "all" | ">24h" | "<24h" | ">48h" | ">7d";

interface Props {
  value: ActivityFilterValue;
  onChange: (value: ActivityFilterValue) => void;
}

const OPTIONS: { value: ActivityFilterValue; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: ">24h", label: "Inativas > 24h" },
  { value: "<24h", label: "Ativas < 24h" },
  { value: ">48h", label: "Inativas > 48h" },
  { value: ">7d", label: "Inativas > 7 dias" },
];

// Parse last_activity_at which can be a Unix timestamp (number) or ISO string
function parseActivityTime(value: number | string): number {
  if (typeof value === "number") {
    // Unix timestamp in seconds — convert to ms
    return value < 1e12 ? value * 1000 : value;
  }
  return new Date(value).getTime();
}

export function filterByActivity<T extends { last_activity_at?: number | string }>(
  items: T[],
  filter: ActivityFilterValue
): T[] {
  if (filter === "all") return items;

  const now = Date.now();
  const HOUR = 3600_000;

  return items.filter((item) => {
    if (!item.last_activity_at) return filter.startsWith(">");
    const activityMs = parseActivityTime(item.last_activity_at);
    const diff = now - activityMs;

    switch (filter) {
      case ">24h":
        return diff > 24 * HOUR;
      case "<24h":
        return diff <= 24 * HOUR;
      case ">48h":
        return diff > 48 * HOUR;
      case ">7d":
        return diff > 7 * 24 * HOUR;
      default:
        return true;
    }
  });
}

export default function LastActivityFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <Label className="text-sm whitespace-nowrap">Ultima atividade:</Label>
      <Select value={value} onValueChange={(v) => onChange(v as ActivityFilterValue)}>
        <SelectTrigger className="w-[180px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

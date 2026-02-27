"use client";

import { AlertTriangle } from "lucide-react";

interface Props {
  filteredCount: number;
  totalCount: number;
}

export default function BlacklistNotice({ filteredCount, totalCount }: Props) {
  if (filteredCount <= 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <span>
        <strong>{filteredCount}</strong> de {totalCount} contato{totalCount !== 1 ? "s" : ""}{" "}
        {filteredCount === 1 ? "foi filtrado" : "foram filtrados"} pela blacklist
        (ja receberam este template recentemente).
      </span>
    </div>
  );
}

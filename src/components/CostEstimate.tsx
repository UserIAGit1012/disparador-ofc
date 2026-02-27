"use client";

import { DollarSign } from "lucide-react";
import { estimateCostUsd, usdToBrl, formatUsd, formatBrl } from "@/lib/costs";

interface Props {
  messageCount: number;
  category: string;
}

export default function CostEstimate({ messageCount, category }: Props) {
  if (messageCount <= 0) return null;

  const costUsd = estimateCostUsd(messageCount, category);
  const costBrl = usdToBrl(costUsd);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <DollarSign className="h-4 w-4" />
      <span>
        Custo estimado:{" "}
        <strong className="text-foreground">{formatUsd(costUsd)}</strong>
        {" / "}
        <strong className="text-foreground">{formatBrl(costBrl)}</strong>
        {" "}({(category || "MARKETING").toUpperCase()})
      </span>
    </div>
  );
}

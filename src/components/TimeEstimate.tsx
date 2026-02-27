"use client";

import { Clock } from "lucide-react";
import { estimateTimeSeconds, formatDuration } from "@/lib/costs";

interface Props {
  messageCount: number;
  delayMin: number;
  delayMax: number;
}

export default function TimeEstimate({ messageCount, delayMin, delayMax }: Props) {
  if (messageCount <= 0) return null;

  const totalSeconds = estimateTimeSeconds(messageCount, delayMin, delayMax);
  const formatted = formatDuration(totalSeconds);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span>
        Tempo estimado: <strong className="text-foreground">{formatted}</strong>
        {" "}para {messageCount} mensagem{messageCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

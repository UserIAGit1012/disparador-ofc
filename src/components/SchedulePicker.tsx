"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar, X } from "lucide-react";

interface Props {
  scheduledAt: string | null;
  onScheduleChange: (value: string | null) => void;
}

export default function SchedulePicker({ scheduledAt, onScheduleChange }: Props) {
  // Build min datetime (now + 5 minutes)
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  const minDatetime = now.toISOString().slice(0, 16);

  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Agendamento (opcional)
      </Label>
      <p className="text-sm text-muted-foreground">
        Deixe vazio para disparar imediatamente, ou selecione uma data/hora para agendar.
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="datetime-local"
          min={minDatetime}
          value={scheduledAt || ""}
          onChange={(e) => onScheduleChange(e.target.value || null)}
          className="max-w-xs"
        />
        {scheduledAt && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onScheduleChange(null)}
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>
      {scheduledAt && (
        <p className="text-sm text-blue-600">
          Agendado para: {new Date(scheduledAt).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}

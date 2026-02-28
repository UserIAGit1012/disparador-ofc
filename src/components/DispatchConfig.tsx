"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TimeEstimate from "@/components/TimeEstimate";
import CostEstimate from "@/components/CostEstimate";
import SchedulePicker from "@/components/SchedulePicker";

interface Agent {
  id: number;
  name: string;
  availability_status: string;
}

interface Props {
  delayMin: number;
  delayMax: number;
  onDelayMinChange: (value: number) => void;
  onDelayMaxChange: (value: number) => void;
  blacklistDays: number;
  onBlacklistDaysChange: (value: number) => void;
  scheduledAt: string | null;
  onScheduleChange: (value: string | null) => void;
  messageCount: number;
  templateCategory: string;
  openConversation: boolean;
  onOpenConversationChange: (value: boolean) => void;
  assignAgentId: number | null;
  onAssignAgentChange: (value: number | null) => void;
  agents: Agent[];
}

export default function DispatchConfig({
  delayMin,
  delayMax,
  onDelayMinChange,
  onDelayMaxChange,
  blacklistDays,
  onBlacklistDaysChange,
  scheduledAt,
  onScheduleChange,
  messageCount,
  templateCategory,
  openConversation,
  onOpenConversationChange,
  assignAgentId,
  onAssignAgentChange,
  agents,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-base font-semibold">Configuracao de Delay</Label>
        <p className="text-sm text-muted-foreground">
          Define o intervalo aleatorio (em segundos) entre cada envio de mensagem.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="delayMin">Delay Minimo (s)</Label>
            <Input
              id="delayMin"
              type="number"
              min={1}
              value={delayMin}
              onChange={(e) => onDelayMinChange(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delayMax">Delay Maximo (s)</Label>
            <Input
              id="delayMax"
              type="number"
              min={1}
              value={delayMax}
              onChange={(e) => onDelayMaxChange(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>

        {delayMax < delayMin && (
          <p className="text-sm text-destructive">
            O delay maximo deve ser maior ou igual ao delay minimo.
          </p>
        )}
      </div>

      <Separator />

      {/* Blacklist */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Blacklist (filtro de duplicatas)</Label>
        <p className="text-sm text-muted-foreground">
          Contatos que receberam o mesmo template nos ultimos N dias serao filtrados.
          Coloque 0 para desativar.
        </p>
        <Input
          type="number"
          min={0}
          value={blacklistDays}
          onChange={(e) => onBlacklistDaysChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="max-w-[120px]"
        />
      </div>

      <Separator />

      {/* Schedule */}
      <SchedulePicker scheduledAt={scheduledAt} onScheduleChange={onScheduleChange} />

      <Separator />

      {/* Post-dispatch actions */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Acoes pos-envio</Label>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="openConversation"
            checked={openConversation}
            onCheckedChange={(checked) => {
              const value = checked === true;
              onOpenConversationChange(value);
              if (!value) onAssignAgentChange(null);
            }}
          />
          <Label htmlFor="openConversation" className="text-sm font-normal cursor-pointer">
            Abrir conversa apos envio
          </Label>
        </div>

        {openConversation && agents.length > 0 && (
          <div className="space-y-2 pl-6">
            <Label htmlFor="assignAgent" className="text-sm">Atribuir ao agente:</Label>
            <Select
              value={assignAgentId?.toString() ?? "none"}
              onValueChange={(val) => onAssignAgentChange(val === "none" ? null : Number(val))}
            >
              <SelectTrigger className="w-full max-w-[300px]">
                <SelectValue placeholder="Nenhum (nao atribuir)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (nao atribuir)</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Separator />

      {/* Estimates */}
      <div className="space-y-2">
        <TimeEstimate messageCount={messageCount} delayMin={delayMin} delayMax={delayMax} />
        <CostEstimate messageCount={messageCount} category={templateCategory} />
      </div>
    </div>
  );
}

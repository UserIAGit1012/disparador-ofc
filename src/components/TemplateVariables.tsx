"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Template, TemplateVarsConfig, TemplateVarType } from "@/types";

interface Props {
  template: Template | null;
  variablesConfig: TemplateVarsConfig;
  onChange: (config: TemplateVarsConfig) => void;
}

const VAR_TYPE_OPTIONS: { value: TemplateVarType; label: string }[] = [
  { value: "fixed", label: "Texto fixo" },
  { value: "contact_name", label: "Nome do contato" },
  { value: "contact_phone", label: "Telefone do contato" },
];

export default function TemplateVariables({ template, variablesConfig, onChange }: Props) {
  const bodyVariables = useMemo(() => {
    if (!template) return [];
    const bodyComponent = template.components?.find((c) => c.type === "BODY");
    if (!bodyComponent?.text) return [];
    const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    return Array.from(new Set(matches)).map((m) => m.replace(/[{}]/g, ""));
  }, [template]);

  const hasHeaderMedia = useMemo(() => {
    if (!template) return false;
    const headerComponent = template.components?.find((c) => c.type === "HEADER");
    return (
      headerComponent?.format === "IMAGE" ||
      headerComponent?.format === "VIDEO" ||
      headerComponent?.format === "DOCUMENT"
    );
  }, [template]);

  if (!template || (bodyVariables.length === 0 && !hasHeaderMedia)) {
    return null;
  }

  const handleTypeChange = (key: string, type: TemplateVarType) => {
    onChange({
      ...variablesConfig,
      [key]: { type, value: type === "fixed" ? (variablesConfig[key]?.value || "") : undefined },
    });
  };

  const handleValueChange = (key: string, value: string) => {
    onChange({
      ...variablesConfig,
      [key]: { ...variablesConfig[key], type: "fixed", value },
    });
  };

  const getConfig = (key: string) => variablesConfig[key] || { type: "fixed", value: "" };

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">Variaveis do Template</Label>

      {hasHeaderMedia && (
        <div className="space-y-2">
          <Label htmlFor="header_media_url">URL da Midia (Cabecalho)</Label>
          <Input
            id="header_media_url"
            placeholder="https://exemplo.com/imagem.jpg"
            value={getConfig("header_media_url").value || ""}
            onChange={(e) => handleValueChange("header_media_url", e.target.value)}
          />
        </div>
      )}

      {bodyVariables.map((varNum) => {
        const config = getConfig(varNum);
        return (
          <div key={varNum} className="space-y-2">
            <Label htmlFor={`var_${varNum}`}>Variavel {`{{${varNum}}}`}</Label>
            <div className="flex gap-2">
              <Select
                value={config.type}
                onValueChange={(val) => handleTypeChange(varNum, val as TemplateVarType)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAR_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {config.type === "fixed" && (
                <Input
                  id={`var_${varNum}`}
                  placeholder={`Valor para {{${varNum}}}`}
                  value={config.value || ""}
                  onChange={(e) => handleValueChange(varNum, e.target.value)}
                  className="flex-1"
                />
              )}
            </div>
            {config.type === "contact_name" && (
              <p className="text-xs text-muted-foreground">
                Sera preenchido com o nome de cada contato automaticamente.
              </p>
            )}
            {config.type === "contact_phone" && (
              <p className="text-xs text-muted-foreground">
                Sera preenchido com o telefone de cada contato automaticamente.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

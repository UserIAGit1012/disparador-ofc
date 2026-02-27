"use client";

import { useEffect, useState, useMemo, ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { Template, TemplateVarsConfig } from "@/types";

interface Props {
  accountId: number | null;
  inboxId: number | null;
  value: Template | null;
  onChange: (template: Template) => void;
  variablesConfig?: TemplateVarsConfig;
}

export default function TemplateSelector({ accountId, inboxId, value, onChange, variablesConfig }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId || !inboxId) {
      setTemplates([]);
      return;
    }
    setLoading(true);
    api.getTemplates(accountId, inboxId)
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [accountId, inboxId]);

  const selectedTemplate = value;

  // Extract variable placeholders from template body
  const getBodyText = (template: Template): string => {
    const bodyComponent = template.components?.find((c) => c.type === "BODY");
    return bodyComponent?.text || "";
  };

  const getHeaderText = (template: Template): string => {
    const headerComponent = template.components?.find((c) => c.type === "HEADER");
    return headerComponent?.text || "";
  };

  const getFooterText = (template: Template): string => {
    const footerComponent = template.components?.find((c) => c.type === "FOOTER");
    return footerComponent?.text || "";
  };

  const resolvePreviewText = useMemo(() => {
    return (text: string): ReactNode[] => {
      if (!text || !variablesConfig) return [text];

      const parts: ReactNode[] = [];
      const regex = /\{\{(\d+)\}\}/g;
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.slice(lastIndex, match.index));
        }

        const varNum = match[1];
        const config = variablesConfig[varNum];
        let resolved: string | null = null;

        if (config) {
          switch (config.type) {
            case "fixed":
              resolved = config.value || null;
              break;
            case "contact_name":
              resolved = "[Nome do contato]";
              break;
            case "contact_phone":
              resolved = "[Telefone do contato]";
              break;
          }
        }

        if (resolved) {
          parts.push(
            <span key={match.index} className="bg-primary/15 text-primary font-medium rounded px-1">
              {resolved}
            </span>
          );
        } else {
          parts.push(
            <span key={match.index} className="text-muted-foreground">
              {match[0]}
            </span>
          );
        }

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
      }

      return parts;
    };
  }, [variablesConfig]);

  return (
    <div className="space-y-3">
      <Label>Template de Mensagem</Label>
      <Select
        value={value?.name || ""}
        onValueChange={(name) => {
          const tpl = templates.find((t) => t.name === name);
          if (tpl) onChange(tpl);
        }}
        disabled={!accountId || !inboxId || loading}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Carregando..." : "Selecione o template"} />
        </SelectTrigger>
        <SelectContent>
          {templates.map((tpl) => (
            <SelectItem key={tpl.name} value={tpl.name}>
              {tpl.name} ({tpl.language})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedTemplate && (
        <Card className="bg-muted/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedTemplate.category}</Badge>
              <Badge variant="outline">{selectedTemplate.language}</Badge>
            </div>
            {getHeaderText(selectedTemplate) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Cabecalho</p>
                <p className="text-sm">{resolvePreviewText(getHeaderText(selectedTemplate))}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground">Corpo</p>
              <p className="text-sm whitespace-pre-wrap">{resolvePreviewText(getBodyText(selectedTemplate))}</p>
            </div>
            {getFooterText(selectedTemplate) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Rodape</p>
                <p className="text-sm text-muted-foreground">{getFooterText(selectedTemplate)}</p>
              </div>
            )}
            {selectedTemplate.components?.find((c) => c.type === "BUTTONS") && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Botoes</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedTemplate.components
                    .find((c) => c.type === "BUTTONS")
                    ?.buttons?.map((btn, i) => (
                      <Badge key={i} variant="outline">
                        {btn.text}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  Phone,
  Building2,
} from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  onCreated?: () => void;
}

type Category = "MARKETING" | "UTILITY" | "AUTHENTICATION";
type HeaderFormat = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
type ButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER";

interface ButtonDraft {
  type: ButtonType;
  text: string;
  url?: string;
  phone_number?: string;
}

interface NumberOption {
  businessId: string;
  businessName: string;
  businessWaba: string;
  wabaId: string;
  numberId: string;
  displayPhone: string;
  verifiedName: string;
}

const LANGUAGES = [
  { value: "pt_BR", label: "Portugues (Brasil)" },
  { value: "pt_PT", label: "Portugues (Portugal)" },
  { value: "en_US", label: "Ingles (EUA)" },
  { value: "es_ES", label: "Espanhol" },
  { value: "es_MX", label: "Espanhol (Mexico)" },
];

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\d+)\}\}/g) || [];
  const nums = matches.map((m) => m.replace(/\{\{|\}\}/g, ""));
  return Array.from(new Set(nums)).sort((a, b) => parseInt(a) - parseInt(b));
}

export default function MetaTemplateCreator({ onCreated }: Props) {
  const [numberOptions, setNumberOptions] = useState<NumberOption[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(true);
  const [numbersError, setNumbersError] = useState<string | null>(null);
  const [selectedNumberKey, setSelectedNumberKey] = useState<string>("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("MARKETING");
  const [language, setLanguage] = useState("pt_BR");

  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerExample, setHeaderExample] = useState<string[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");

  const [bodyText, setBodyText] = useState("");
  const [bodyExamples, setBodyExamples] = useState<string[]>([]);

  const [footerText, setFooterText] = useState("");

  const [buttons, setButtons] = useState<ButtonDraft[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const headerVars = useMemo(() => extractVariables(headerText), [headerText]);
  const bodyVars = useMemo(() => extractVariables(bodyText), [bodyText]);

  // Sync example arrays with detected variables
  if (headerVars.length !== headerExample.length) {
    setHeaderExample((prev) => {
      const next = [...prev];
      while (next.length < headerVars.length) next.push("");
      next.length = headerVars.length;
      return next;
    });
  }
  if (bodyVars.length !== bodyExamples.length) {
    setBodyExamples((prev) => {
      const next = [...prev];
      while (next.length < bodyVars.length) next.push("");
      next.length = bodyVars.length;
      return next;
    });
  }

  // Load numbers from all BMs
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingNumbers(true);
      setNumbersError(null);
      try {
        const data = await api.getAllMetaNumbers();
        if (cancelled) return;
        const opts: NumberOption[] = [];
        for (const group of data) {
          for (const n of group.numbers || []) {
            opts.push({
              businessId: group.business.id,
              businessName: group.business.name,
              businessWaba: group.business.business_account_id,
              wabaId: n.waba_id || group.business.business_account_id,
              numberId: n.id,
              displayPhone: n.display_phone_number,
              verifiedName: n.verified_name,
            });
          }
        }
        setNumberOptions(opts);
        if (!selectedNumberKey && opts.length > 0) {
          setSelectedNumberKey(`${opts[0].businessId}::${opts[0].numberId}`);
        }
      } catch (err: any) {
        if (!cancelled) setNumbersError(err.message);
      } finally {
        if (!cancelled) setLoadingNumbers(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedNumber = useMemo(
    () => numberOptions.find((o) => `${o.businessId}::${o.numberId}` === selectedNumberKey),
    [numberOptions, selectedNumberKey]
  );

  const reset = () => {
    setName("");
    setCategory("MARKETING");
    setLanguage("pt_BR");
    setHeaderFormat("NONE");
    setHeaderText("");
    setHeaderExample([]);
    setHeaderMediaUrl("");
    setBodyText("");
    setBodyExamples([]);
    setFooterText("");
    setButtons([]);
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!selectedNumber) return setError("Selecione o numero de destino");

    const slug = name.trim().toLowerCase();
    if (!slug) return setError("Nome obrigatorio");
    if (!/^[a-z0-9_]+$/.test(slug)) {
      return setError(
        "Nome deve conter apenas letras minusculas, numeros e underscore"
      );
    }
    if (!bodyText.trim()) return setError("Corpo (BODY) obrigatorio");
    if (bodyVars.some((_, i) => !bodyExamples[i]?.trim())) {
      return setError("Preencha exemplo para todas as variaveis do corpo");
    }
    if (headerFormat === "TEXT" && headerText.trim()) {
      if (headerVars.some((_, i) => !headerExample[i]?.trim())) {
        return setError("Preencha exemplo para a variavel do header");
      }
    }
    if (
      ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) &&
      !headerMediaUrl.trim()
    ) {
      return setError("URL de exemplo da midia do header obrigatoria");
    }
    for (const btn of buttons) {
      if (!btn.text.trim()) return setError("Texto de todos os botoes obrigatorio");
      if (btn.type === "URL" && !btn.url?.trim())
        return setError("URL obrigatoria nos botoes do tipo URL");
      if (btn.type === "PHONE_NUMBER" && !btn.phone_number?.trim())
        return setError("Telefone obrigatorio nos botoes do tipo PHONE_NUMBER");
    }

    // Build components
    const components: any[] = [];

    if (headerFormat === "TEXT" && headerText.trim()) {
      const comp: any = { type: "HEADER", format: "TEXT", text: headerText };
      if (headerVars.length > 0) {
        comp.example = { header_text: headerExample };
      }
      components.push(comp);
    } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat)) {
      components.push({
        type: "HEADER",
        format: headerFormat,
        example: { header_handle: [headerMediaUrl] },
      });
    }

    const bodyComp: any = { type: "BODY", text: bodyText };
    if (bodyVars.length > 0) {
      bodyComp.example = { body_text: [bodyExamples] };
    }
    components.push(bodyComp);

    if (footerText.trim()) {
      components.push({ type: "FOOTER", text: footerText.trim() });
    }

    if (buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map((b) => {
          const out: any = { type: b.type, text: b.text.trim() };
          if (b.type === "URL") out.url = b.url?.trim();
          if (b.type === "PHONE_NUMBER") out.phone_number = b.phone_number?.trim();
          return out;
        }),
      });
    }

    setSubmitting(true);
    try {
      const result = await api.createMetaTemplate(selectedNumber.businessId, {
        waba_id: selectedNumber.wabaId,
        name: slug,
        language,
        category,
        components,
      });
      setSuccess(
        `Template "${slug}" submetido para ${selectedNumber.businessName} (${selectedNumber.displayPhone}). Status: ${result.status || "PENDING"}.`
      );
      reset();
      onCreated?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Criar Template
        </CardTitle>
        <CardDescription>
          Selecione o numero de destino e submeta o template direto pra Meta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Numero de destino */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Phone className="h-4 w-4" /> Numero de destino
          </Label>
          {loadingNumbers ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-md">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando numeros das BMs...
            </div>
          ) : numbersError ? (
            <p className="text-sm text-destructive bg-destructive/10 rounded p-2">
              {numbersError}
            </p>
          ) : numberOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded p-3">
              Nenhum numero disponivel. Cadastre uma BM na aba "Credenciais".
            </p>
          ) : (
            <Select value={selectedNumberKey} onValueChange={setSelectedNumberKey}>
              <SelectTrigger className="h-auto py-2">
                <SelectValue placeholder="Selecione um numero" />
              </SelectTrigger>
              <SelectContent>
                {numberOptions.map((o) => {
                  const key = `${o.businessId}::${o.numberId}`;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-mono text-sm">{o.displayPhone}</span>
                        <span className="text-xs text-muted-foreground">
                          {o.verifiedName} · {o.businessName}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          {selectedNumber && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span>
                Sera criado em <strong>{selectedNumber.businessName}</strong> (WABA{" "}
                <span className="font-mono">{selectedNumber.businessWaba}</span>)
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* Identificacao */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="tpl-name">Nome</Label>
            <Input
              id="tpl-name"
              placeholder="boas_vindas"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase())}
            />
            <p className="text-xs text-muted-foreground">
              minusculas, numeros, underscore
            </p>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MARKETING">Marketing</SelectItem>
                <SelectItem value="UTILITY">Utilidade</SelectItem>
                <SelectItem value="AUTHENTICATION">Autenticacao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Idioma</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Header</Label>
            <Select
              value={headerFormat}
              onValueChange={(v) => setHeaderFormat(v as HeaderFormat)}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sem header</SelectItem>
                <SelectItem value="TEXT">Texto</SelectItem>
                <SelectItem value="IMAGE">Imagem</SelectItem>
                <SelectItem value="VIDEO">Video</SelectItem>
                <SelectItem value="DOCUMENT">Documento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {headerFormat === "TEXT" && (
            <>
              <Input
                placeholder="Ola {{1}}!"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
              />
              {headerVars.length > 0 && (
                <div className="space-y-1">
                  {headerVars.map((v, i) => (
                    <div key={v} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono w-12">
                        {`{{${v}}}`}
                      </span>
                      <Input
                        placeholder={`Exemplo para variavel ${v}`}
                        value={headerExample[i] || ""}
                        onChange={(e) => {
                          const next = [...headerExample];
                          next[i] = e.target.value;
                          setHeaderExample(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) && (
            <div className="space-y-1">
              <Input
                placeholder="https://exemplo.com/midia (URL publica de amostra)"
                value={headerMediaUrl}
                onChange={(e) => setHeaderMediaUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5" />
                Meta usa essa URL apenas como referencia para aprovar o template.
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Body */}
        <div className="space-y-2">
          <Label htmlFor="tpl-body">Corpo (obrigatorio)</Label>
          <textarea
            id="tpl-body"
            rows={5}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Ola {{1}}, seu pedido {{2}} foi confirmado!"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
          />
          {bodyVars.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-xs text-muted-foreground">Exemplos das variaveis</p>
              {bodyVars.map((v, i) => (
                <div key={v} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono w-12">
                    {`{{${v}}}`}
                  </span>
                  <Input
                    placeholder={`Exemplo para {{${v}}}`}
                    value={bodyExamples[i] || ""}
                    onChange={(e) => {
                      const next = [...bodyExamples];
                      next[i] = e.target.value;
                      setBodyExamples(next);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Footer */}
        <div className="space-y-2">
          <Label htmlFor="tpl-footer">Rodape (opcional)</Label>
          <Input
            id="tpl-footer"
            placeholder="Ex: Para parar de receber, responda PARAR"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            maxLength={60}
          />
        </div>

        <Separator />

        {/* Botoes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Botoes (opcional, max 10)</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setButtons((prev) =>
                  prev.length >= 10
                    ? prev
                    : [...prev, { type: "QUICK_REPLY", text: "" }]
                )
              }
            >
              <Plus className="mr-1 h-3 w-3" /> Adicionar
            </Button>
          </div>

          {buttons.map((btn, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{i + 1}</Badge>
                <Select
                  value={btn.type}
                  onValueChange={(v) => {
                    const next = [...buttons];
                    next[i] = { ...next[i], type: v as ButtonType };
                    setButtons(next);
                  }}
                >
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QUICK_REPLY">Resposta rapida</SelectItem>
                    <SelectItem value="URL">URL</SelectItem>
                    <SelectItem value="PHONE_NUMBER">Telefone</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() =>
                    setButtons((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Texto do botao"
                value={btn.text}
                onChange={(e) => {
                  const next = [...buttons];
                  next[i] = { ...next[i], text: e.target.value };
                  setButtons(next);
                }}
                maxLength={25}
              />
              {btn.type === "URL" && (
                <Input
                  placeholder="https://exemplo.com/{{1}}"
                  value={btn.url || ""}
                  onChange={(e) => {
                    const next = [...buttons];
                    next[i] = { ...next[i], url: e.target.value };
                    setButtons(next);
                  }}
                />
              )}
              {btn.type === "PHONE_NUMBER" && (
                <Input
                  placeholder="+5511999999999"
                  value={btn.phone_number || ""}
                  onChange={(e) => {
                    const next = [...buttons];
                    next[i] = { ...next[i], phone_number: e.target.value };
                    setButtons(next);
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded p-2 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-700 bg-green-50 rounded p-2">{success}</p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitting || !selectedNumber}
          className="w-full"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Criar Template
        </Button>
      </CardContent>
    </Card>
  );
}

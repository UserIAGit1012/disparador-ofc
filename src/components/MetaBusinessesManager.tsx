"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Save,
  Trash2,
  Pencil,
  X,
  Building2,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";

interface BusinessRow {
  id: string;
  name: string;
  business_account_id: string;
  access_token_masked: string;
}

interface Props {
  onChange?: () => void;
}

export default function MetaBusinessesManager({ onChange }: Props) {
  const [items, setItems] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftWaba, setDraftWaba] = useState("");
  const [draftToken, setDraftToken] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editWaba, setEditWaba] = useState("");
  const [editToken, setEditToken] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listMetaBusinesses();
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleAdd = async () => {
    setError(null);
    if (!draftName.trim() || !draftWaba.trim() || !draftToken.trim()) {
      setError("Preencha nome, WABA ID e access token");
      return;
    }
    setSubmitting(true);
    try {
      await api.createMetaBusiness({
        name: draftName.trim(),
        business_account_id: draftWaba.trim(),
        access_token: draftToken.trim(),
      });
      setDraftName("");
      setDraftWaba("");
      setDraftToken("");
      setAdding(false);
      await reload();
      onChange?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (b: BusinessRow) => {
    setEditingId(b.id);
    setEditName(b.name);
    setEditWaba(b.business_account_id);
    setEditToken("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditWaba("");
    setEditToken("");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.updateMetaBusiness(editingId, {
        name: editName,
        business_account_id: editWaba,
        ...(editToken.trim() ? { access_token: editToken.trim() } : {}),
      });
      cancelEdit();
      await reload();
      onChange?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover Business "${name}"? Os templates ja criados na Meta NAO sao excluidos.`))
      return;
    setSubmitting(true);
    try {
      await api.deleteMetaBusiness(id);
      await reload();
      onChange?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Manager Accounts
          </CardTitle>
          <CardDescription>
            Cadastre todas as suas BMs/WABAs. Os numeros e templates de todas
            aparecerao juntos nas outras abas.
          </CardDescription>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar BM
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded p-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {adding && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Nova BM</h4>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  setDraftName("");
                  setDraftWaba("");
                  setDraftToken("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome (apelido)</Label>
                <Input
                  placeholder="Ex: Business 1 - Peak"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>WABA ID</Label>
                <Input
                  placeholder="ex: 784707179919795"
                  value={draftWaba}
                  onChange={(e) => setDraftWaba(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Access Token</Label>
              <Input
                type="password"
                placeholder="EAAxxxxx..."
                value={draftToken}
                onChange={(e) => setDraftToken(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setAdding(false);
                  setDraftName("");
                  setDraftWaba("");
                  setDraftToken("");
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma BM cadastrada. Clique em "Adicionar BM" para comecar.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((b) => {
              const editing = editingId === b.id;
              return (
                <li key={b.id} className="rounded-md border p-3">
                  {editing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input
                          placeholder="Nome"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                        <Input
                          placeholder="WABA ID"
                          value={editWaba}
                          onChange={(e) => setEditWaba(e.target.value)}
                        />
                      </div>
                      <Input
                        type="password"
                        placeholder="Novo token (deixe vazio pra manter o atual)"
                        value={editToken}
                        onChange={(e) => setEditToken(e.target.value)}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={cancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit} disabled={submitting}>
                          {submitting ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-1 h-4 w-4" />
                          )}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{b.name}</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {b.business_account_id}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          token: {b.access_token_masked}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(b)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(b.id, b.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

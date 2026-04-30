"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  UserPlus,
  Trash2,
  Save,
  Copy,
  KeyRound,
  Download,
  AlertCircle,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";

interface UserRow {
  user_id: string;
  email: string;
  name: string | null;
  is_admin: boolean;
  allowed_phone_ids: string[];
  allowed_waba_ids: string[];
  created_at?: string;
  last_sign_in_at?: string;
}

interface NumberOption {
  businessId: string;
  businessName: string;
  wabaId: string;
  wabaName?: string;
  numberId: string;
  displayPhone: string;
  verifiedName: string;
}

interface JustCreated {
  email: string;
  password: string;
  user_id?: string;
  error?: string;
}

export default function AdminUsersPage() {
  const { profile, user: meUser, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [numberOptions, setNumberOptions] = useState<NumberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNumbers, setLoadingNumbers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bulkEmails, setBulkEmails] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<JustCreated[]>([]);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});

  const reload = async () => {
    setLoading(true);
    setLoadingNumbers(true);
    setError(null);

    api.listUsers()
      .then((u) => setUsers(u || []))
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));

    api.getAllMetaNumbers()
      .then((numGroups) => {
        const opts: NumberOption[] = [];
        for (const g of numGroups || []) {
          for (const n of g.numbers || []) {
            opts.push({
              businessId: g.business.id,
              businessName: g.business.name,
              wabaId: (n as any).waba_id || g.business.business_account_id,
              wabaName: (n as any).waba_name,
              numberId: String(n.id),
              displayPhone: n.display_phone_number,
              verifiedName: n.verified_name,
            });
          }
        }
        setNumberOptions(opts);
      })
      .catch(() => {
        // numbers panel will just show "Nenhum número descoberto"
      })
      .finally(() => setLoadingNumbers(false));
  };

  useEffect(() => {
    if (!authLoading && profile.isAdmin) reload();
  }, [authLoading, profile.isAdmin]);

  const numbersByBusiness = useMemo(() => {
    const map = new Map<string, { businessName: string; numbers: NumberOption[] }>();
    for (const o of numberOptions) {
      if (!map.has(o.businessId))
        map.set(o.businessId, { businessName: o.businessName, numbers: [] });
      map.get(o.businessId)!.numbers.push(o);
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [numberOptions]);

  const handleBulkCreate = async () => {
    setError(null);
    const emails = bulkEmails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) return setError("Cole pelo menos um email");
    setCreating(true);
    try {
      const result = await api.bulkCreateUsers(emails);
      setJustCreated(result);
      setBulkEmails("");
      await reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const togglePhone = (u: UserRow, opt: NumberOption) => {
    const has = u.allowed_phone_ids.includes(opt.numberId);
    const newPhones = has
      ? u.allowed_phone_ids.filter((p) => p !== opt.numberId)
      : [...u.allowed_phone_ids, opt.numberId];
    // Recompute waba ids: collect waba ids of all selected phone numbers
    const numberToWaba = new Map(numberOptions.map((o) => [o.numberId, o.wabaId]));
    const newWabas = Array.from(
      new Set(newPhones.map((id) => numberToWaba.get(id)).filter(Boolean) as string[])
    );
    setUsers((prev) =>
      prev.map((row) =>
        row.user_id === u.user_id
          ? { ...row, allowed_phone_ids: newPhones, allowed_waba_ids: newWabas }
          : row
      )
    );
  };

  const setUserField = <K extends keyof UserRow>(
    userId: string,
    field: K,
    value: UserRow[K]
  ) => {
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, [field]: value } : u))
    );
  };

  const handleSave = async (u: UserRow) => {
    setSavingId(u.user_id);
    try {
      await api.updateUser(u.user_id, {
        name: u.name || "",
        is_admin: u.is_admin,
        allowed_phone_ids: u.allowed_phone_ids,
        allowed_waba_ids: u.allowed_waba_ids,
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`Deletar usuario ${u.email}? Acao irreversivel.`)) return;
    try {
      await api.deleteUser(u.user_id);
      await reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (u: UserRow) => {
    if (
      !confirm(
        `Gerar nova senha para ${u.email}? A senha antiga vai parar de funcionar.`
      )
    )
      return;
    try {
      const r = await api.resetUserPassword(u.user_id);
      setResetPasswords((prev) => ({ ...prev, [u.user_id]: r.password }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const exportCsv = () => {
    if (justCreated.length === 0) return;
    const rows = [["email", "password", "error"]];
    for (const r of justCreated) {
      rows.push([r.email, r.password || "", r.error || ""]);
    }
    const csv = rows
      .map((r) => r.map((c) => `"${(c || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios-criados-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile.isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold">Acesso restrito</h2>
        <p className="text-muted-foreground mt-2">
          Esta area e exclusiva para administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Usuarios</h2>
        <p className="text-muted-foreground">
          Crie acessos pros experts e atribua quais numeros eles podem usar.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded p-3">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Bulk create */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Criar em lote
          </CardTitle>
          <CardDescription>
            Cole 1 email por linha (ou separados por virgula). O sistema gera senhas
            aleatorias e cria os usuarios. Voce so consegue ver as senhas{" "}
            <strong>uma vez</strong> — exporte antes de sair.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            placeholder={"angela@email.com\njohan@email.com\ncarlao@email.com"}
            value={bulkEmails}
            onChange={(e) => setBulkEmails(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={handleBulkCreate} disabled={creating || !bulkEmails.trim()}>
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Criar usuarios
            </Button>
          </div>

          {justCreated.length > 0 && (
            <div className="space-y-2 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {justCreated.filter((j) => j.user_id).length} usuario(s) criado(s)
                </p>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="mr-2 h-3 w-3" /> Exportar CSV
                </Button>
              </div>
              <div className="rounded-md border max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Senha</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {justCreated.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono">{r.email}</td>
                        <td className="p-2 font-mono flex items-center gap-2">
                          {r.password ? (
                            <>
                              {r.password}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => copyText(r.password!)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-2">
                          {r.error ? (
                            <span className="text-destructive text-xs">{r.error}</span>
                          ) : (
                            <span className="text-green-700 text-xs">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-amber-700">
                ⚠️ Senhas em texto puro — exporte agora se for distribuir.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users list with assignments */}
      <Card>
        <CardHeader>
          <CardTitle>
            Usuarios cadastrados ({users.length})
          </CardTitle>
          <CardDescription>
            Marque os numeros que cada usuario pode acessar. Admin nao precisa de
            atribuicoes — ja ve tudo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum usuario.
            </p>
          ) : (
            <div className="space-y-4">
              {users.map((u) => {
                const isMe = meUser?.id === u.user_id;
                const isDirty = false; // simple v1: always allow Save
                const resetPw = resetPasswords[u.user_id];
                return (
                  <div
                    key={u.user_id}
                    className="rounded-lg border p-4 space-y-3 bg-card"
                  >
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-[240px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{u.email}</span>
                          {u.is_admin && <Badge>Admin</Badge>}
                          {isMe && (
                            <Badge variant="outline" className="text-xs">
                              voce
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>
                            {u.allowed_phone_ids.length} numero(s) atribuido(s)
                          </span>
                          {u.last_sign_in_at && (
                            <span>
                              ultimo login:{" "}
                              {new Date(u.last_sign_in_at).toLocaleString("pt-BR")}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Nome (opcional)</Label>
                            <Input
                              value={u.name || ""}
                              onChange={(e) =>
                                setUserField(u.user_id, "name", e.target.value)
                              }
                              className="h-8"
                              placeholder="Nome do expert"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-5">
                            <Checkbox
                              id={`admin-${u.user_id}`}
                              checked={u.is_admin}
                              disabled={isMe}
                              onCheckedChange={(v) =>
                                setUserField(u.user_id, "is_admin", v === true)
                              }
                            />
                            <Label
                              htmlFor={`admin-${u.user_id}`}
                              className="text-xs"
                            >
                              Admin (vê tudo)
                            </Label>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetPassword(u)}
                        >
                          <KeyRound className="mr-1 h-3 w-3" /> Reset senha
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSave(u)}
                          disabled={savingId === u.user_id}
                        >
                          {savingId === u.user_id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="mr-1 h-3 w-3" />
                          )}
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(u)}
                          disabled={isMe}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="mr-1 h-3 w-3" /> Deletar
                        </Button>
                      </div>
                    </div>

                    {resetPw && (
                      <div className="rounded-md border-2 border-amber-400 bg-amber-50 p-2 text-xs flex items-center gap-2">
                        <span className="font-medium">Nova senha:</span>
                        <span className="font-mono">{resetPw}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => copyText(resetPw)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <span className="text-amber-700">— copie agora, some ao recarregar</span>
                      </div>
                    )}

                    {!u.is_admin && (
                      <div className="border-t pt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Numeros que este usuario pode acessar
                        </p>
                        {loadingNumbers ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Carregando numeros (Meta Graph API, pode levar 10-30s)...
                          </p>
                        ) : numbersByBusiness.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Nenhum numero descoberto. Adicione BMs primeiro.
                          </p>
                        ) : (
                          <div className="space-y-3 max-h-72 overflow-auto rounded-md border p-2 bg-muted/20">
                            {numbersByBusiness.map((bg) => (
                              <div key={bg.id}>
                                <p className="text-xs font-semibold mb-1">
                                  {bg.businessName}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                  {bg.numbers.map((opt) => {
                                    const checked = u.allowed_phone_ids.includes(
                                      opt.numberId
                                    );
                                    return (
                                      <label
                                        key={opt.numberId}
                                        className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-background cursor-pointer"
                                      >
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={() => togglePhone(u, opt)}
                                        />
                                        <span className="font-mono">
                                          {opt.displayPhone}
                                        </span>
                                        <span className="text-muted-foreground truncate">
                                          {opt.verifiedName}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

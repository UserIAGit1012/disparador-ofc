"use client";

import { useAuth } from "@/components/AuthProvider";
import { useAccount } from "@/components/AccountProvider";
import LoginPage from "@/app/login/page";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, Loader2 } from "lucide-react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { accounts, selectedAccount, loading: loadingAccounts, selectAccount } = useAccount();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4">
          <h1 className="text-xl font-bold">Disparador</h1>

          {/* Account selector in header */}
          <div className="ml-4">
            <Select
              value={selectedAccount?.id?.toString() || ""}
              onValueChange={(v) => selectAccount(parseInt(v))}
              disabled={loadingAccounts}
            >
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder={loadingAccounts ? "Carregando..." : "Selecione a conta"} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <nav className="ml-auto flex items-center gap-4">
            <a href="/" className="text-sm font-medium hover:underline">
              Overview
            </a>
            <a href="/disparos" className="text-sm font-medium hover:underline">
              Historico
            </a>
            <a href="/dashboard" className="text-sm font-medium hover:underline">
              Metricas
            </a>
            <div className="flex items-center gap-2 ml-2 pl-4 border-l">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

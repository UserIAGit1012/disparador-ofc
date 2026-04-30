"use client";

import { useEffect, useState } from "react";

export default function ResetPage() {
  const [steps, setSteps] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const log = (s: string) => setSteps((prev) => [...prev, s]);

      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) {
            await r.unregister();
            log(`✓ Service worker desregistrado: ${r.scope}`);
          }
          if (regs.length === 0) log("✓ Nenhum service worker registrado.");
        }

        if ("caches" in window) {
          const keys = await caches.keys();
          for (const k of keys) {
            await caches.delete(k);
            log(`✓ Cache deletado: ${k}`);
          }
          if (keys.length === 0) log("✓ Nenhum cache armazenado.");
        }

        try {
          localStorage.clear();
          log("✓ localStorage limpo.");
        } catch {
          log("✗ localStorage falhou.");
        }
        try {
          sessionStorage.clear();
          log("✓ sessionStorage limpo.");
        } catch {
          log("✗ sessionStorage falhou.");
        }

        if (window.indexedDB?.databases) {
          const dbs = await window.indexedDB.databases();
          for (const db of dbs) {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name);
              log(`✓ IndexedDB deletado: ${db.name}`);
            }
          }
        }

        log("");
        log("→ Pronto! Recarregue agora com Ctrl+Shift+R");
        setDone(true);
      } catch (err: any) {
        log(`Erro: ${err.message}`);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-card border rounded-lg p-6 space-y-3">
        <h1 className="text-xl font-bold">Reset do navegador</h1>
        <p className="text-sm text-muted-foreground">
          Esta página desregistra service workers, limpa caches, localStorage,
          sessionStorage e IndexedDB para este origin.
        </p>
        <pre className="bg-muted/50 rounded p-3 text-xs whitespace-pre-wrap font-mono">
          {steps.join("\n")}
        </pre>
        {done && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                window.location.href = "/login";
              }}
              className="bg-primary text-primary-foreground rounded px-4 py-2 text-sm"
            >
              Ir para login
            </button>
            <button
              onClick={() => window.location.reload()}
              className="border rounded px-4 py-2 text-sm"
            >
              Recarregar esta página
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

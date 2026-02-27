import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import AccountProvider from "@/components/AccountProvider";
import AppShell from "@/components/AppShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Disparador de Mensagens",
  description: "Sistema de disparo em massa de mensagens WhatsApp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          <AccountProvider>
            <AppShell>{children}</AppShell>
          </AccountProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

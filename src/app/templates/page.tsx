"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/AuthProvider";
import MetaBusinessesManager from "@/components/MetaBusinessesManager";
import MetaPhoneNumbers from "@/components/MetaPhoneNumbers";
import MetaTemplateCreator from "@/components/MetaTemplateCreator";
import MetaTemplateList from "@/components/MetaTemplateList";

export default function TemplatesPage() {
  const { profile } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Templates Meta</h2>
        <p className="text-muted-foreground">
          {profile.isAdmin
            ? "Cadastre suas BMs uma vez e gerencie templates/numeros de todas elas em um lugar so."
            : "Gerencie os templates dos numeros que voce tem acesso."}
        </p>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="numbers">Numeros</TabsTrigger>
          {profile.isAdmin && (
            <TabsTrigger value="credentials">Credenciais (BMs)</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <MetaTemplateCreator onCreated={() => setReloadKey((k) => k + 1)} />
          <MetaTemplateList reloadKey={reloadKey} />
        </TabsContent>

        <TabsContent value="numbers">
          <MetaPhoneNumbers />
        </TabsContent>

        {profile.isAdmin && (
          <TabsContent value="credentials">
            <MetaBusinessesManager onChange={() => setReloadKey((k) => k + 1)} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

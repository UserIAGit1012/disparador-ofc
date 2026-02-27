"use client";

import { useState } from "react";
import { useAccount } from "@/components/AccountProvider";
import AccountOverview from "@/components/AccountOverview";
import DispatchForm from "@/components/DispatchForm";
import DispatchMonitor from "@/components/DispatchMonitor";

type View = "overview" | "new-dispatch" | "monitor";

export default function Dashboard() {
  const { accountId, selectedAccount } = useAccount();
  const [view, setView] = useState<View>("overview");
  const [monitorDispatchId, setMonitorDispatchId] = useState<string | null>(null);

  if (!accountId) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground text-lg">
          Selecione uma conta no menu acima para comecar.
        </p>
      </div>
    );
  }

  if (view === "new-dispatch") {
    return (
      <DispatchForm
        accountId={accountId}
        onDispatchCreated={(id) => {
          setMonitorDispatchId(id);
          setView("monitor");
        }}
        onBack={() => setView("overview")}
      />
    );
  }

  if (view === "monitor" && monitorDispatchId) {
    return (
      <DispatchMonitor
        dispatchId={monitorDispatchId}
        onBack={() => setView("overview")}
      />
    );
  }

  return (
    <AccountOverview
      accountId={accountId}
      accountName={selectedAccount?.name}
      onNewDispatch={() => setView("new-dispatch")}
      onMonitorDispatch={(id) => {
        setMonitorDispatchId(id);
        setView("monitor");
      }}
    />
  );
}

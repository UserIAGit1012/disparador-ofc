"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api";
import type { Account } from "@/types";

interface AccountContextValue {
  accounts: Account[];
  selectedAccount: Account | null;
  accountId: number | null;
  loading: boolean;
  selectAccount: (id: number) => void;
}

const AccountContext = createContext<AccountContextValue>({
  accounts: [],
  selectedAccount: null,
  accountId: null,
  loading: true,
  selectAccount: () => {},
});

export function useAccount() {
  return useContext(AccountContext);
}

export default function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAccounts()
      .then((data: any[]) => {
        const mapped = data.map((a) => ({ id: a.id, name: a.name }));
        setAccounts(mapped);

        // Auto-select if only one account or restore from localStorage
        const savedId = localStorage.getItem("selectedAccountId");
        if (savedId) {
          const found = mapped.find((a) => a.id === parseInt(savedId));
          if (found) setSelectedAccount(found);
        }
        if (!savedId && mapped.length === 1) {
          setSelectedAccount(mapped[0]);
          localStorage.setItem("selectedAccountId", mapped[0].id.toString());
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectAccount = (id: number) => {
    const acc = accounts.find((a) => a.id === id);
    if (acc) {
      setSelectedAccount(acc);
      localStorage.setItem("selectedAccountId", id.toString());
    }
  };

  return (
    <AccountContext.Provider
      value={{
        accounts,
        selectedAccount,
        accountId: selectedAccount?.id ?? null,
        loading,
        selectAccount,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

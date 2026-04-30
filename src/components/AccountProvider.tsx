"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
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
  const { user, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAccounts([]);
      setSelectedAccount(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    api.getAccounts()
      .then((data: any[]) => {
        const mapped = data.map((a) => ({ id: a.id, name: a.name }));
        setAccounts(mapped);

        const savedId = localStorage.getItem("selectedAccountId");
        const savedMatch = savedId
          ? mapped.find((a) => a.id === parseInt(savedId))
          : null;

        if (savedMatch) {
          setSelectedAccount(savedMatch);
        } else if (mapped.length === 1) {
          setSelectedAccount(mapped[0]);
          localStorage.setItem("selectedAccountId", mapped[0].id.toString());
        } else if (savedId && !savedMatch) {
          // Saved selection no longer accessible (e.g., user perms changed)
          localStorage.removeItem("selectedAccountId");
          setSelectedAccount(null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id, authLoading]);

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

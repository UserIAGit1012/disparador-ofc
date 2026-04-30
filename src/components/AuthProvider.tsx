"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { api } from "@/lib/api";

interface Profile {
  isAdmin: boolean;
  allowedPhoneIds: string[];
  allowedWabaIds: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: Profile;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const DEFAULT_PROFILE: Profile = {
  isAdmin: false,
  allowedPhoneIds: [],
  allowedWabaIds: [],
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  profile: DEFAULT_PROFILE,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);

  const loadProfile = async (currentSession: Session | null) => {
    if (!currentSession) {
      setProfile(DEFAULT_PROFILE);
      return;
    }
    try {
      const me = await api.getMe();
      setProfile({
        isAdmin: me.is_admin,
        allowedPhoneIds: me.allowed_phone_ids || [],
        allowedWabaIds: me.allowed_waba_ids || [],
      });
    } catch {
      setProfile(DEFAULT_PROFILE);
    }
  };

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }

    sb.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        await loadProfile(session);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Defer profile load OUTSIDE the navigator.locks context held by
      // onAuthStateChange. Calling api.getMe() here would re-enter
      // getSession(), which tries to acquire the same lock -> deadlock.
      setTimeout(() => loadProfile(session), 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const sb = getSupabase();
    if (sb) {
      await sb.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(DEFAULT_PROFILE);
    }
  };

  const refreshProfile = async () => {
    await loadProfile(session);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { getCurrentUser, getErrorMessage, isUnauthorizedError, login } from "@/services/api";
import type { CurrentUser, KnownUser } from "@/types/api";
import {
  mergeKnownUsers,
  persistKnownUsers,
  persistToken,
  readKnownUsers,
  readToken,
  subscribeToKnownUsersStorage,
  subscribeToTokenStorage,
} from "@/lib/storage";

type SessionState = "bootstrapping" | "authenticated" | "anonymous";

type SessionContextValue = {
  state: SessionState;
  token: string | null;
  user: CurrentUser | null;
  knownUsers: KnownUser[];
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);
const EMPTY_KNOWN_USERS: KnownUser[] = [];

function rememberUser(nextUser: CurrentUser, currentUsers: KnownUser[]) {
  const nextUsers = mergeKnownUsers(currentUsers, nextUser);
  persistKnownUsers(nextUsers);
  return nextUsers;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribeToTokenStorage, readToken, () => null);
  const knownUsers = useSyncExternalStore(
    subscribeToKnownUsersStorage,
    readKnownUsers,
    () => EMPTY_KNOWN_USERS,
  );
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (!token || activeToken === token) return;

    let cancelled = false;

    void (async () => {
      try {
        const currentUser = await getCurrentUser(token);
        if (cancelled) return;

        startTransition(() => {
          setActiveToken(token);
          setUser(currentUser);
        });

        rememberUser(currentUser, readKnownUsers());
      } catch (error) {
        if (cancelled) return;

        if (isUnauthorizedError(error)) {
          persistToken(null);
        }

        startTransition(() => {
          setActiveToken(null);
          setUser(null);
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeToken, token]);

  const resolvedUser = activeToken === token ? user : null;
  const state: SessionState = token
    ? resolvedUser
      ? "authenticated"
      : "bootstrapping"
    : "anonymous";

  async function signIn(email: string, password: string) {
    const result = await login({ email, password });

    persistToken(result.access_token);
    startTransition(() => {
      setActiveToken(result.access_token);
      setUser(result.user);
    });

    rememberUser(result.user, readKnownUsers());
  }

  function signOut() {
    persistToken(null);

    startTransition(() => {
      setActiveToken(null);
      setUser(null);
    });
  }

  async function refreshUser() {
    if (!token) return;

    try {
      const currentUser = await getCurrentUser(token);
      startTransition(() => {
        setActiveToken(token);
        setUser(currentUser);
      });
      rememberUser(currentUser, readKnownUsers());
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }

      throw new Error(getErrorMessage(error));
    }
  }

  const value: SessionContextValue = {
    state,
    token,
    user: resolvedUser,
    knownUsers,
    isAdmin: resolvedUser?.role === "admin",
    signIn,
    signOut,
    refreshUser,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within SessionProvider.");
  }

  return context;
}

"use client";

import { useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import { Search, UserRound } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { getErrorMessage, getUsers, isUnauthorizedError } from "@/services/api";
import { cn } from "@/lib/cn";
import type { UserSummary } from "@/types/api";

export function UserDirectoryPicker({
  disabledUserIds = [],
  onSelect,
  onUnauthorized,
  selectedUserId,
  token,
}: {
  disabledUserIds?: number[];
  onSelect: (user: UserSummary) => void;
  onUnauthorized: () => void;
  selectedUserId?: number | null;
  token: string | null;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabledUserIdsKey = disabledUserIds.join(",");

  const loadUsers = useEffectEvent(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const nextUsers = await getUsers(token, {
        limit: 12,
        query: deferredQuery.trim() || undefined,
      });
      setResults(nextUsers.filter((user) => !disabledUserIds.includes(user.id)));
    } catch (loadError) {
      if (isUnauthorizedError(loadError)) {
        onUnauthorized();
        return;
      }

      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadUsers();
  }, [deferredQuery, disabledUserIdsKey, token]);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search users by name or email"
      />

      {error ? <Alert tone="danger" title="Unable to load users" description={error} /> : null}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]" />
          ))}
        </div>
      ) : results.length ? (
        <div className="space-y-2">
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              className={cn(
                "flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition",
                selectedUserId === user.id
                  ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--primary)] hover:bg-[color:var(--surface-subtle)]",
              )}
              onClick={() => onSelect(user)}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{user.name}</p>
                <p className="mt-1 truncate text-sm text-[color:var(--muted)]">{user.email}</p>
              </div>
              <div className="shrink-0 rounded-full border border-[color:var(--border)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted)]">
                {user.role}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<UserRound className="h-5 w-5 text-[color:var(--muted)]" />}
          title="No users found"
          description={
            deferredQuery.trim()
              ? "Try a different name or email search."
              : "No assignable users are available for this project right now."
          }
        />
      )}

      <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
        <Search className="h-3.5 w-3.5" />
        Results come from the backend user directory, not browser-local history.
      </div>
    </div>
  );
}

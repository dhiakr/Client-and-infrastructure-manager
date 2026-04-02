import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { usePreferences } from "@/features/settings/preferences-context";
import { cn } from "@/lib/cn";

export type TableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  emptyState,
  loading,
  rows,
}: {
  columns: TableColumn<T>[];
  emptyState: ReactNode;
  loading?: boolean;
  rows: T[];
}) {
  const { preferences } = usePreferences();
  const rowPadding = preferences.density === "compact" ? "py-2.5" : "py-4";

  return (
    <div className="overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[color:var(--border)]">
          <thead className="bg-[color:var(--surface-muted)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-4">
                        <Skeleton className="h-4 w-full max-w-[11rem]" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, index) => (
                  <tr key={index} className="transition hover:bg-[color:var(--surface-subtle)]">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-4 align-top text-sm text-[color:var(--foreground)]",
                          rowPadding,
                          column.className,
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && !rows.length ? <div className="p-4">{emptyState}</div> : null}
    </div>
  );
}

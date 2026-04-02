import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(232,240,255,0.55),rgba(255,255,255,0))] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">{value}</p>
          {hint ? <p className="mt-2 text-sm text-[color:var(--muted)]">{hint}</p> : null}
        </div>
        {icon ? (
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--primary-soft)] p-3 text-[color:var(--primary)]">
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

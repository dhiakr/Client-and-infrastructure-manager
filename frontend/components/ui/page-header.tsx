import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export function PageHeader({
  actions,
  description,
  eyebrow,
  metadata,
  title,
}: {
  actions?: ReactNode;
  description?: string;
  eyebrow?: string;
  metadata?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-3">
        {eyebrow ? (
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)]">
            {eyebrow}
          </span>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)] md:text-3xl">
            {title}
          </h1>
          {description ? <p className="mt-2 max-w-3xl text-sm text-[color:var(--muted)]">{description}</p> : null}
        </div>
        {metadata ? <div className="flex flex-wrap gap-2">{metadata}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function ScopeNotice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "info";
  children: ReactNode;
}) {
  return (
    <Badge
      tone={tone === "info" ? "info" : "neutral"}
      className={cn("px-3 py-1.5 text-xs font-semibold")}
    >
      {children}
    </Badge>
  );
}

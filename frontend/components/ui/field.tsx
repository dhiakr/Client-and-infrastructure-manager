import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Field({
  children,
  error,
  hint,
  label,
  required,
}: {
  children: ReactNode;
  error?: string | null;
  hint?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-1 text-sm font-medium text-[color:var(--foreground)]">
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="text-sm text-rose-600">{error}</span>
      ) : hint ? (
        <span className="text-sm text-[color:var(--muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function FieldGroup({
  children,
  className,
  title,
  description,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {title ? (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-[color:var(--foreground)]">{title}</h4>
          {description ? <p className="text-sm text-[color:var(--muted)]">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

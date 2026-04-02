import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Card({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[0_18px_40px_rgba(15,23,42,0.06)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[color:var(--border)] px-5 py-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h3 className="text-base font-semibold text-[color:var(--foreground)]">{title}</h3>
        {description ? <p className="mt-1 text-sm text-[color:var(--muted)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

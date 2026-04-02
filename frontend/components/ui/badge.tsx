import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone === "neutral" && "border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--muted)]",
        tone === "info" && "border-[#bfd6ff] bg-[#eaf2ff] text-[#0f52c4]",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-700",
        className,
      )}
    >
      {children}
    </span>
  );
}

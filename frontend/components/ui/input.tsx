import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--foreground)] outline-none transition placeholder:text-slate-400 focus:border-[color:var(--primary)] focus:ring-4 focus:ring-[color:var(--primary-soft)]",
        className,
      )}
      {...props}
    />
  );
}

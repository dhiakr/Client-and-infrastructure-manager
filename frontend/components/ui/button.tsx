import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function Button({
  children,
  className,
  icon,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-60",
        size === "md" && "h-11 px-4 text-sm",
        size === "sm" && "h-9 px-3 text-sm",
        variant === "primary" &&
          "border-[color:var(--primary)] bg-[color:var(--primary)] text-white shadow-[0_14px_28px_rgba(11,99,246,0.18)] hover:border-[color:var(--primary-strong)] hover:bg-[color:var(--primary-strong)]",
        variant === "secondary" &&
          "border-[color:var(--border-strong)] bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-sm hover:border-[color:var(--primary)] hover:bg-[color:var(--surface-muted)]",
        variant === "ghost" &&
          "border-transparent bg-transparent text-[color:var(--muted)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]",
        variant === "danger" &&
          "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

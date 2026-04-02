"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu } from "lucide-react";

import { RoleBadge } from "@/components/ui/status-badge";
import { roleDescription } from "@/lib/format";
import type { CurrentUser } from "@/types/api";

function toBreadcrumbLabel(segment: string) {
  if (/^\d+$/.test(segment)) {
    return `#${segment}`;
  }

  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function Topbar({
  onOpenMobileNav,
  user,
}: {
  onOpenMobileNav: () => void;
  user: CurrentUser;
}) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbStartIndex = segments[0] === "dashboard" ? 1 : 0;
  const breadcrumbSegments = segments.slice(breadcrumbStartIndex);

  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-white/[0.88] backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2 text-[color:var(--muted)] lg:hidden"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <nav className="hidden min-w-0 items-center gap-2 text-sm text-[color:var(--muted)] md:flex">
            <Link href="/dashboard" className="truncate font-medium hover:text-[color:var(--foreground)]">
              Dashboard
            </Link>
            {breadcrumbSegments.map((segment, index) => {
              const href = `/${segments.slice(0, breadcrumbStartIndex + index + 1).join("/")}`;
              const label = toBreadcrumbLabel(segment);

              return (
                <div key={href} className="flex min-w-0 items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-[color:var(--border-strong)]" />
                  <Link href={href} className="truncate hover:text-[color:var(--foreground)]">
                    {label}
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right lg:block">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">{user.name}</p>
            <p className="text-xs text-[color:var(--muted)]">{roleDescription(user)}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

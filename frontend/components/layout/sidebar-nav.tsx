"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, LogOut, PanelLeftOpen, Settings } from "lucide-react";

import { RoleBadge } from "@/components/ui/status-badge";
import { roleDescription } from "@/lib/format";
import { getNavigationForRole } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import type { CurrentUser } from "@/types/api";

export function SidebarNav({
  collapsed,
  onToggle,
  onSignOut,
  user,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onSignOut: () => void;
  user: CurrentUser;
}) {
  const pathname = usePathname();
  const items = getNavigationForRole(user.role);
  const userInitial = user.name.slice(0, 1).toUpperCase();

  const sidebarActionClassName =
    "flex items-center justify-center gap-2 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white transition hover:border-white/[0.20] hover:bg-white/[0.10]";

  return (
    <aside
      className={cn(
        "hidden border-r border-[color:var(--sidebar-border)] bg-[color:var(--sidebar-bg)] text-[color:var(--sidebar-text)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:self-start lg:flex-col lg:overflow-y-auto",
        collapsed ? "lg:w-24" : "lg:w-80",
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--sidebar-border)] px-4 py-5">
        <div className={cn("min-w-0", collapsed && "hidden")}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--sidebar-muted)]">
            Workspace
          </p>
          <h1 className="mt-2 text-lg font-semibold text-white">Client Infrastructure Manager</h1>
          <p className="mt-2 text-sm leading-6 text-[color:var(--sidebar-muted)]">
            A clearer operational view of projects, environments, and access.
          </p>
        </div>
        <button
          type="button"
          className="rounded-2xl border border-[color:var(--sidebar-border)] bg-white/[0.05] p-2 text-[color:var(--sidebar-muted)] transition hover:border-white/[0.15] hover:bg-white/[0.10] hover:text-white"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium transition",
                isActive
                  ? "border-[color:var(--sidebar-active-border)] bg-[color:var(--sidebar-active)] text-white shadow-[0_14px_24px_rgba(4,12,28,0.2)]"
                  : "border-transparent text-[color:var(--sidebar-muted)] hover:border-white/[0.10] hover:bg-white/[0.06] hover:text-white",
                collapsed && "justify-center px-2",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[color:var(--sidebar-border)] p-4">
        <div
          className={cn(
            "rounded-3xl border border-white/[0.10] bg-white/[0.06] p-4 shadow-[0_18px_40px_rgba(4,12,28,0.24)]",
            collapsed && "p-3",
          )}
        >
          <div className={cn("flex items-center gap-3", collapsed && "flex-col")}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--primary)] text-sm font-semibold text-white shadow-[0_12px_24px_rgba(11,99,246,0.28)]">
              {userInitial}
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="mt-1 truncate text-sm text-[color:var(--sidebar-muted)]">{user.email}</p>
                <p className="mt-1 text-xs text-[color:var(--sidebar-muted)]">{roleDescription(user)}</p>
                <div className="mt-3">
                  <RoleBadge role={user.role} />
                </div>
              </div>
            ) : null}
          </div>

          {collapsed ? (
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/settings" className={sidebarActionClassName} aria-label="Open settings">
                <Settings className="h-4 w-4" />
              </Link>
              <button type="button" className={sidebarActionClassName} onClick={onSignOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-4 grid gap-2">
              <Link href="/settings" className={cn(sidebarActionClassName, "justify-start")}>
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <button type="button" className={cn(sidebarActionClassName, "justify-start")} onClick={onSignOut}>
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

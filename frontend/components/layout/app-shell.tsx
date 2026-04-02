"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings, X } from "lucide-react";

import { AgentChatWidget } from "@/components/agent/agent-chat-widget";
import { SignOutConfirmDialog } from "@/components/auth/sign-out-confirm-dialog";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { RoleBadge } from "@/components/ui/status-badge";
import { useSession } from "@/features/auth/session-context";
import { roleDescription } from "@/lib/format";
import { getNavigationForRole } from "@/lib/navigation";
import { cn } from "@/lib/cn";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const { signOut, user } = useSession();
  const pathname = usePathname();

  if (!user) return null;

  const navigation = getNavigationForRole(user.role);

  function handleSignOutRequest() {
    setSignOutConfirmOpen(true);
  }

  function handleSignOutConfirm() {
    setSignOutConfirmOpen(false);
    signOut();
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="flex min-h-screen items-start">
        <SidebarNav
          collapsed={collapsed}
          onToggle={() => setCollapsed((currentValue) => !currentValue)}
          onSignOut={handleSignOutRequest}
          user={user}
        />

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-80 flex-col border-r border-[color:var(--sidebar-border)] bg-[color:var(--sidebar-bg)] p-4 text-[color:var(--sidebar-text)] shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--sidebar-muted)]">
                    Workspace
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">Client Infrastructure Manager</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--sidebar-muted)]">
                    A clearer operational view of projects, environments, and access.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-2xl border border-[color:var(--sidebar-border)] bg-white/[0.05] p-2 text-[color:var(--sidebar-muted)]"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {navigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium transition",
                        isActive
                          ? "border-[color:var(--sidebar-active-border)] bg-[color:var(--sidebar-active)] text-white"
                          : "border-transparent text-[color:var(--sidebar-muted)] hover:border-white/[0.10] hover:bg-white/[0.06] hover:text-white",
                      )}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              <div className="mt-auto rounded-3xl border border-white/[0.10] bg-white/[0.06] p-4 shadow-[0_18px_40px_rgba(4,12,28,0.24)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--primary)] text-sm font-semibold text-white shadow-[0_12px_24px_rgba(11,99,246,0.28)]">
                    {user.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                    <p className="mt-1 truncate text-sm text-[color:var(--sidebar-muted)]">{user.email}</p>
                    <p className="mt-1 text-xs text-[color:var(--sidebar-muted)]">{roleDescription(user)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <RoleBadge role={user.role} />
                </div>
                <div className="mt-4 grid gap-2">
                  <Link
                    href="/settings"
                    className="flex items-center justify-start gap-2 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white transition hover:border-white/[0.20] hover:bg-white/[0.10]"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <button
                    type="button"
                    className="flex items-center justify-start gap-2 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white transition hover:border-white/[0.20] hover:bg-white/[0.10]"
                    onClick={() => {
                      setMobileNavOpen(false);
                      handleSignOutRequest();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className={cn("flex min-h-screen min-w-0 flex-1 flex-col")}>
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} user={user} />
          <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1440px] space-y-6">{children}</div>
          </main>
        </div>
      </div>

      <SignOutConfirmDialog
        onClose={() => setSignOutConfirmOpen(false)}
        onConfirm={handleSignOutConfirm}
        open={signOutConfirmOpen}
      />
      <AgentChatWidget />
    </div>
  );
}

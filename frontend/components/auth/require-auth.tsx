"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useSession } from "@/features/auth/session-context";

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useSession();

  useEffect(() => {
    if (state === "anonymous") {
      const nextPath = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${nextPath}`);
    }
  }, [pathname, router, state]);

  if (state !== "authenticated") {
    return <SessionSplash />;
  }

  return <>{children}</>;
}

export function GuestOnly({
  children,
  redirectTo = "/dashboard",
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state === "authenticated") {
      router.replace(redirectTo);
    }
  }, [redirectTo, router, state]);

  if (state === "authenticated" || state === "bootstrapping") {
    return <SessionSplash />;
  }

  return <>{children}</>;
}

export function SessionSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4">
      <Card className="w-full max-w-sm p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-slate-950">Client Infrastructure Manager</h1>
        <p className="mt-2 text-sm text-slate-500">Loading your workspace and permissions.</p>
      </Card>
    </div>
  );
}

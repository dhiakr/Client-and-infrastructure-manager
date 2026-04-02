"use client";

import type { ReactNode } from "react";

import { SessionProvider } from "@/features/auth/session-context";
import { PreferencesProvider } from "@/features/settings/preferences-context";
import { ToastProvider } from "@/components/ui/toast-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <PreferencesProvider>
        <ToastProvider>{children}</ToastProvider>
      </PreferencesProvider>
    </SessionProvider>
  );
}

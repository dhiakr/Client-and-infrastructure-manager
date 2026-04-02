"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { GuestOnly } from "@/components/auth/require-auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/auth/session-context";
import { usePreferences } from "@/features/settings/preferences-context";
import { useToast } from "@/components/ui/toast-provider";
import { resolveAuthenticatedPath } from "@/lib/auth-redirect";
import { getErrorMessage } from "@/services/api";

export function LoginPage({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const { preferences } = usePreferences();
  const { signIn } = useSession();
  const { pushToast } = useToast();

  const [form, setForm] = useState<{ email: string; password: string }>({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectPath = resolveAuthenticatedPath(nextPath, preferences.landingPage);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signIn(form.email, form.password);
      pushToast({
        title: "Signed in",
        description: "Your workspace is ready.",
        tone: "success",
      });
      router.replace(redirectPath);
      router.refresh();
    } catch (signInError) {
      setError(getErrorMessage(signInError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <GuestOnly redirectTo={redirectPath}>
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(11,99,246,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(15,118,110,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.46),rgba(255,255,255,0.12))]" />
        <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/45 blur-3xl" />

        <Card className="relative w-full max-w-md border-white/70 bg-white/88 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl sm:p-10">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Client Infrastructure Manager
                </p>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                    Sign in
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    Enter your credentials to access the workspace.
                  </p>
                </div>
              </div>
            </div>

            {error ? <Alert tone="danger" title="Unable to sign in" description={error} /> : null}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <Field label="Email" required>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={form.email}
                  onChange={(event) =>
                    setForm((currentValue) => ({ ...currentValue, email: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field label="Password" required>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((currentValue) => ({ ...currentValue, password: event.target.value }))
                  }
                  required
                />
              </Field>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </GuestOnly>
  );
}

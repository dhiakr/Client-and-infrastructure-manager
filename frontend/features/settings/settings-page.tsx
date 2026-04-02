"use client";

import { useEffect, useState } from "react";
import { Layers3 } from "lucide-react";


import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import { useSession } from "@/features/auth/session-context";
import { usePreferences } from "@/features/settings/preferences-context";
import {  getBackendDbHealth, getBackendHealth, getErrorMessage } from "@/services/api";
import type { BackendHealth, DatabaseHealth } from "@/types/api";

type HealthState = {
  backend?: BackendHealth;
  database?: DatabaseHealth;
  error?: string;
};

export function SettingsPage() {
  const { preferences, updatePreferences } = usePreferences();
  const { user } = useSession();
  const { pushToast } = useToast();
  const [health, setHealth] = useState<HealthState>({});

  useEffect(() => {
    async function loadHealth() {
      try {
        const [backend, database] = await Promise.all([getBackendHealth(), getBackendDbHealth()]);
        setHealth({ backend, database });
      } catch (healthError) {
        setHealth({ error: getErrorMessage(healthError) });
      }
    }

    void loadHealth();
  }, []);

  function handlePreferenceUpdate<
    Key extends keyof typeof preferences,
  >(key: Key, value: (typeof preferences)[Key]) {
    updatePreferences({ [key]: value });
    pushToast({
      title: "Preference saved",
      description: "Your interface settings update immediately.",
      tone: "success",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Review your account."
      />

      {health.error ? (
        <Alert tone="warning" title="Health data unavailable" description={health.error} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Profile" description="Current account details and role scope." />
          <div className="space-y-5 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Name</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{user?.name}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Email</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{user?.email}</p>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Role</p>
              <div className="mt-2 flex items-center gap-3">
                <Badge tone={user?.role === "admin" ? "info" : "neutral"}>
                  {user?.role === "admin" ? "Admin" : "Standard user"}
                </Badge>
                <span className="text-sm text-slate-500">
                  {user?.role === "admin"
                    ? "Full access to clients, projects, instances, and assignments."
                    : "Access scoped to assigned projects and related instances."}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Interface preferences" description="Preferences persist in local storage for this browser." />
          <div className="space-y-5 p-5">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
                  <Layers3 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">Table density</p>
                  <p className="mt-1 text-sm text-slate-500">Use compact rows for dense operations, or comfortable rows for readability.</p>
                  <div className="mt-4">
                    <Select
                      value={preferences.density}
                      onChange={(event) =>
                        handlePreferenceUpdate("density", event.target.value as typeof preferences.density)
                      }
                    >
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                    </Select>
                  </div>
                </div>
              </div>
            </div>



            <label className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Show record IDs</p>
                <p className="mt-1 text-sm text-slate-500">Display IDs in workspace metadata and admin support flows.</p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                checked={preferences.showRecordIds}
                onChange={(event) => handlePreferenceUpdate("showRecordIds", event.target.checked)}
              />
            </label>
          </div>
        </Card>
      </div>

    </div>
  );
}

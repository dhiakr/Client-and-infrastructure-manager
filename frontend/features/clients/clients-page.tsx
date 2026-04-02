"use client";

import { useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { Building2, FolderKanban, Plus, Shield } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, ForbiddenState } from "@/components/ui/page-state";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast-provider";
import { ClientFormSheet } from "@/features/clients/client-form-sheet";
import { useSession } from "@/features/auth/session-context";
import { countActiveProduction, formatDateTime, pluralize } from "@/lib/format";
import { flattenProjectInstances, groupInstancesByProject, groupProjectsByClient } from "@/lib/records";
import {
  createClient,
  deleteClient,
  getClients,
  getErrorMessage,
  getProjects,
  isUnauthorizedError,
  updateClient,
} from "@/services/api";
import type { Client, ProjectWorkspace } from "@/types/api";

export function ClientsPage() {
  const { isAdmin, signOut, token } = useSession();
  const { pushToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sheetMode, setSheetMode] = useState<"create" | "edit" | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  async function loadClientsWorkspace() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const nextClients = await getClients(token);
      const nextProjects = await getProjects(token);

      setClients(nextClients);
      setProjects(nextProjects);
    } catch (loadError) {
      if (isUnauthorizedError(loadError)) {
        signOut();
        return;
      }

      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  const loadClientsWorkspaceOnMount = useEffectEvent(() => {
    void loadClientsWorkspace();
  });

  useEffect(() => {
    if (!isAdmin) return;
    loadClientsWorkspaceOnMount();
  }, [isAdmin, token]);

  if (!isAdmin) {
    return <ForbiddenState />;
  }

  if (error && !clients.length && !loading) {
    return <ErrorState description={error} onRetry={() => void loadClientsWorkspace()} />;
  }

  const instances = flattenProjectInstances(projects);
  const projectsByClient = groupProjectsByClient(projects);
  const instancesByProject = groupInstancesByProject(instances);
  const filteredClients = clients.filter((client) =>
    deferredQuery ? client.name.toLowerCase().includes(deferredQuery) : true,
  );

  const columns: TableColumn<Client>[] = [
    {
      key: "client",
      header: "Client",
      render: (client) => (
        <div>
          <Link href={`/clients/${client.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
            {client.name}
          </Link>
          <p className="mt-1 text-sm text-slate-500">Updated {formatDateTime(client.updated_at)}</p>
        </div>
      ),
    },
    {
      key: "projects",
      header: "Projects",
      render: (client) => {
        const clientProjects = projectsByClient[client.id] ?? [];
        return (
          <span className="text-sm text-slate-600">
            {clientProjects.length} {pluralize(clientProjects.length, "project")}
          </span>
        );
      },
    },
    {
      key: "production",
      header: "Active production",
      render: (client) => {
        const clientProjects = projectsByClient[client.id] ?? [];
        const relatedInstances = clientProjects.flatMap((project) => instancesByProject[project.id] ?? []);
        return <span className="text-sm text-slate-600">{countActiveProduction(relatedInstances)}</span>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-[1%] whitespace-nowrap",
      render: (client) => (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedClient(client);
              setSheetError(null);
              setSheetMode("edit");
            }}
          >
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(client)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  async function handleClientSubmit(name: string) {
    if (!token) return;

    setSheetLoading(true);
    setSheetError(null);

    try {
      if (sheetMode === "edit" && selectedClient) {
        await updateClient(token, selectedClient.id, { name });
        pushToast({
          title: "Client updated",
          description: `${name} is now saved.`,
          tone: "success",
        });
      } else {
        await createClient(token, { name });
        pushToast({
          title: "Client created",
          description: `${name} is now available in the portfolio.`,
          tone: "success",
        });
      }

      setSheetMode(null);
      setSelectedClient(null);
      await loadClientsWorkspace();
    } catch (submitError) {
      setSheetError(getErrorMessage(submitError));
    } finally {
      setSheetLoading(false);
    }
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return;

    try {
      await deleteClient(token, deleteTarget.id);
      pushToast({
        title: "Client deleted",
        description: `${deleteTarget.name} was removed from the workspace.`,
        tone: "success",
      });
      setDeleteTarget(null);
      await loadClientsWorkspace();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  const totalProjects = projects.length;
  const totalActiveProduction = countActiveProduction(instances);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Accounts"
        title="Clients"
        description="Manage the customer portfolio and review how projects and production environments are distributed."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setSheetMode("create")}>
            Create client
          </Button>
        }
      />

      {error ? <Alert tone="warning" title="Unable to refresh clients" description={error} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Clients" value={clients.length} icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Projects" value={totalProjects} icon={<FolderKanban className="h-5 w-5" />} />
        <StatCard label="Active production" value={totalActiveProduction} icon={<Shield className="h-5 w-5" />} />
      </div>

      <Card className="space-y-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Portfolio list</h2>
            <p className="mt-1 text-sm text-slate-500">Search clients and inspect project coverage.</p>
          </div>
          <div className="w-full max-w-sm">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search clients"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          loading={loading}
          rows={filteredClients}
          emptyState={
            <EmptyState
              title={query ? "No clients match the current search" : "No clients yet"}
              description={
                query
                  ? "Try a broader search term or clear the filter."
                  : "Create the first client to begin organising projects and environments."
              }
              action={
                !query ? (
                  <Button onClick={() => setSheetMode("create")}>Create client</Button>
                ) : undefined
              }
            />
          }
        />
      </Card>

      <ClientFormSheet
        key={`${sheetMode ?? "closed"}-${selectedClient?.id ?? "new"}-${String(sheetMode !== null)}`}
        error={sheetError}
        initialName={selectedClient?.name ?? ""}
        loading={sheetLoading}
        mode={sheetMode === "edit" ? "edit" : "create"}
        onClose={() => {
          setSheetMode(null);
          setSelectedClient(null);
          setSheetError(null);
        }}
        onSubmit={handleClientSubmit}
        open={sheetMode !== null}
      />

      <ConfirmDialog
        confirmLabel="Delete client"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name} and all nested project data. This action cannot be undone.`
            : ""
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        open={Boolean(deleteTarget)}
        title="Delete client"
      />
    </div>
  );
}

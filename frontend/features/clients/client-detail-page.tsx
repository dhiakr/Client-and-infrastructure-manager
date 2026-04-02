"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { Building2, FolderKanban, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, ForbiddenState, NotFoundState } from "@/components/ui/page-state";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast-provider";
import { ClientFormSheet } from "@/features/clients/client-form-sheet";
import { ProjectFormSheet } from "@/features/projects/project-form-sheet";
import { useSession } from "@/features/auth/session-context";
import { countActiveProduction, formatDateTime } from "@/lib/format";
import { flattenProjectInstances, groupInstancesByProject } from "@/lib/records";
import {
  createProject,
  getClient,
  getClients,
  getErrorMessage,
  getProjects,
  isUnauthorizedError,
  updateClient,
} from "@/services/api";
import type { Client, ProjectWorkspace } from "@/types/api";

export function ClientDetailPage({ clientId }: { clientId: number }) {
  const { isAdmin, signOut, token } = useSession();
  const { pushToast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientEditorOpen, setClientEditorOpen] = useState(false);
  const [projectEditorOpen, setProjectEditorOpen] = useState(false);
  const [clientFormError, setClientFormError] = useState<string | null>(null);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  const [savingProject, setSavingProject] = useState(false);

  async function loadClientWorkspace() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const [currentClient, visibleClients, allProjects] = await Promise.all([
        getClient(token, clientId),
        getClients(token),
        getProjects(token),
      ]);
      const clientProjects = allProjects.filter((project) => project.client_id === clientId);

      setClient(currentClient);
      setClients(visibleClients);
      setProjects(clientProjects);
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

  const loadClientWorkspaceOnMount = useEffectEvent(() => {
    void loadClientWorkspace();
  });

  useEffect(() => {
    if (!isAdmin) return;
    loadClientWorkspaceOnMount();
  }, [clientId, isAdmin, token]);

  if (!isAdmin) return <ForbiddenState />;
  if (error?.toLowerCase().includes("not found")) return <NotFoundState />;
  if (error && !loading && !client) {
    return <ErrorState description={error} onRetry={() => void loadClientWorkspace()} />;
  }

  const instances = flattenProjectInstances(projects);
  const instancesByProject = groupInstancesByProject(instances);
  const projectColumns: TableColumn<(typeof projects)[number]>[] = [
    {
      key: "project",
      header: "Project",
      render: (project) => (
        <div>
          <Link href={`/projects/${project.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
            {project.name}
          </Link>
          <p className="mt-1 text-sm text-slate-500">{project.description ?? "No description provided."}</p>
        </div>
      ),
    },
    {
      key: "instances",
      header: "Instances",
      render: (project) => (instancesByProject[project.id] ?? []).length,
    },
    {
      key: "production",
      header: "Active production",
      render: (project) => countActiveProduction(instancesByProject[project.id] ?? []),
    },
    {
      key: "updated",
      header: "Updated",
      render: (project) => formatDateTime(project.updated_at),
    },
  ];

  async function handleClientSave(name: string) {
    if (!token || !client) return;

    setSavingClient(true);
    setClientFormError(null);

    try {
      await updateClient(token, client.id, { name });
      pushToast({
        title: "Client updated",
        description: `${name} is now saved.`,
        tone: "success",
      });
      setClientEditorOpen(false);
      await loadClientWorkspace();
    } catch (saveError) {
      setClientFormError(getErrorMessage(saveError));
    } finally {
      setSavingClient(false);
    }
  }

  async function handleProjectCreate(value: {
    clientId: string;
    description: string;
    name: string;
  }) {
    if (!token) return;

    setSavingProject(true);
    setProjectFormError(null);

    try {
      await createProject(token, {
        client_id: Number(value.clientId),
        description: value.description.trim() || null,
        name: value.name,
      });
      pushToast({
        title: "Project created",
        description: `${value.name} was added to this client.`,
        tone: "success",
      });
      setProjectEditorOpen(false);
      await loadClientWorkspace();
    } catch (saveError) {
      setProjectFormError(getErrorMessage(saveError));
    } finally {
      setSavingProject(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client detail"
        title={client?.name ?? "Loading client"}
        description="Review the client portfolio and manage the projects operating under this account."
        actions={
          <>
            <Button variant="secondary" onClick={() => setClientEditorOpen(true)}>
              Edit client
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setProjectEditorOpen(true)}>
              Create project
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Projects" value={projects.length} icon={<FolderKanban className="h-5 w-5" />} />
        <StatCard label="Instances" value={instances.length} icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Active production" value={countActiveProduction(instances)} icon={<FolderKanban className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
        <Card>
          <CardHeader
            title="Projects"
            description="Projects associated with this client account."
            action={
              <Button size="sm" variant="secondary" onClick={() => setProjectEditorOpen(true)}>
                Add project
              </Button>
            }
          />
          <div className="p-5">
            <DataTable
              columns={projectColumns}
              loading={loading}
              rows={projects}
              emptyState={
                <EmptyState
                  title="No projects for this client"
                  description="Create the first project to start managing infrastructure for this account."
                  action={<Button onClick={() => setProjectEditorOpen(true)}>Create project</Button>}
                />
              }
            />
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Client summary" description="Current account metadata." />
            <div className="space-y-4 p-5">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Name</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{client?.name ?? "..."}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Updated</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{formatDateTime(client?.updated_at)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Created</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{formatDateTime(client?.created_at)}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ClientFormSheet
        key={`client-${client?.id ?? "unknown"}-${String(clientEditorOpen)}`}
        error={clientFormError}
        initialName={client?.name ?? ""}
        loading={savingClient}
        mode="edit"
        onClose={() => {
          setClientEditorOpen(false);
          setClientFormError(null);
        }}
        onSubmit={handleClientSave}
        open={clientEditorOpen}
      />

      <ProjectFormSheet
        key={`client-project-${clientId}-${String(projectEditorOpen)}`}
        clients={clients}
        error={projectFormError}
        initialValue={{
          clientId: String(clientId),
          description: "",
          name: "",
        }}
        loading={savingProject}
        mode="create"
        onClose={() => {
          setProjectEditorOpen(false);
          setProjectFormError(null);
        }}
        onSubmit={handleProjectCreate}
        open={projectEditorOpen}
      />
    </div>
  );
}

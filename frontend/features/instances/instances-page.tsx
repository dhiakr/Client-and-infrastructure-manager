"use client";

import { useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { Plus, ServerCog } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader, ScopeNotice } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/page-state";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { InstanceTypeBadge, StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { useSession } from "@/features/auth/session-context";
import { InstanceFormSheet, type InstanceFormValue } from "@/features/instances/instance-form-sheet";
import { getProductionConflictMessage } from "@/features/instances/production-rule";
import { byId, flattenProjectInstances } from "@/lib/records";
import {
  createProjectInstance,
  deleteProjectInstance,
  getClients,
  getErrorMessage,
  getProjects,
  isUnauthorizedError,
  updateProjectInstance,
} from "@/services/api";
import type { Client, Instance, ProjectWorkspace } from "@/types/api";

export function InstancesPage() {
  const { isAdmin, signOut, token } = useSession();
  const { pushToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editorTarget, setEditorTarget] = useState<Instance | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Instance | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  async function loadInstancesWorkspace() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const [nextClients, nextProjects] = await Promise.all([getClients(token), getProjects(token)]);

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

  const loadInstancesWorkspaceOnMount = useEffectEvent(() => {
    void loadInstancesWorkspace();
  });

  useEffect(() => {
    loadInstancesWorkspaceOnMount();
  }, [token]);

  const instances = flattenProjectInstances(projects);

  if (error && !instances.length && !loading) {
    return <ErrorState description={error} onRetry={() => void loadInstancesWorkspace()} />;
  }

  const clientLookup = byId(clients);
  const projectLookup = byId(projects);
  const filteredProjects = clientFilter
    ? projects.filter((project) => String(project.client_id) === clientFilter)
    : projects;

  const filteredInstances = instances.filter((instance) => {
    const project = projectLookup[instance.project_id];
    const clientMatches = clientFilter ? String(project?.client_id ?? "") === clientFilter : true;
    const projectMatches = projectFilter ? String(instance.project_id) === projectFilter : true;
    const typeMatches = typeFilter ? instance.type === typeFilter : true;
    const statusMatches = statusFilter ? instance.status === statusFilter : true;
    const queryMatches = deferredQuery
      ? instance.name.toLowerCase().includes(deferredQuery) ||
        (project?.name ?? "").toLowerCase().includes(deferredQuery) ||
        (instance.url ?? "").toLowerCase().includes(deferredQuery)
      : true;

    return clientMatches && projectMatches && typeMatches && statusMatches && queryMatches;
  });

  const columns: TableColumn<Instance>[] = [
    {
      key: "instance",
      header: "Instance",
      render: (instance) => (
        <div>
          <p className="font-semibold text-slate-900">{instance.name}</p>
          <p className="mt-1 text-sm text-slate-500">{projectLookup[instance.project_id]?.name ?? "Unknown project"}</p>
        </div>
      ),
    },
    {
      key: "client",
      header: "Client",
      render: (instance) => {
        const project = projectLookup[instance.project_id];
        return project?.client.name ?? clientLookup[project?.client_id ?? -1]?.name ?? "Unknown client";
      },
    },
    {
      key: "type",
      header: "Type",
      render: (instance) => <InstanceTypeBadge type={instance.type} />,
    },
    {
      key: "status",
      header: "Status",
      render: (instance) => <StatusBadge status={instance.status} />,
    },
    {
      key: "url",
      header: "URL",
      render: (instance) =>
        instance.url ? (
          <a href={instance.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
            {instance.url}
          </a>
        ) : (
          <span className="text-slate-400">No URL</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-[1%] whitespace-nowrap",
      render: (instance) => (
        <div className="flex items-center gap-2">
          <Link href={`/projects/${instance.project_id}`}>
            <Button variant="secondary" size="sm">
              Project
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setEditorTarget(instance);
              setEditorMode("edit");
              setEditorError(null);
            }}
          >
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(instance)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  async function handleInstanceSubmit(value: InstanceFormValue) {
    if (!token) return;

    const targetProjectId =
      editorMode === "edit" && editorTarget ? editorTarget.project_id : Number(value.projectId);
    const relatedInstances = instances.filter((instance) => instance.project_id === targetProjectId);
    const conflictMessage = getProductionConflictMessage(relatedInstances, value, editorTarget?.id);

    if (conflictMessage) {
      setEditorError(conflictMessage);
      return;
    }

    setEditorLoading(true);
    setEditorError(null);

    try {
      if (editorMode === "edit" && editorTarget) {
        await updateProjectInstance(token, editorTarget.id, {
          name: value.name,
          status: value.status,
          type: value.type,
          url: value.url || null,
        });
        pushToast({
          title: "Instance updated",
          description: `${value.name} is now saved.`,
          tone: "success",
        });
      } else {
        await createProjectInstance(token, Number(value.projectId), {
          name: value.name,
          status: value.status,
          type: value.type,
          url: value.url || null,
        });
        pushToast({
          title: "Instance created",
          description: `${value.name} was added.`,
          tone: "success",
        });
      }

      setEditorMode(null);
      setEditorTarget(null);
      await loadInstancesWorkspace();
    } catch (submitError) {
      setEditorError(getErrorMessage(submitError));
    } finally {
      setEditorLoading(false);
    }
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return;

    try {
      await deleteProjectInstance(token, deleteTarget.id);
      pushToast({
        title: "Instance deleted",
        description: `${deleteTarget.name} was removed.`,
        tone: "success",
      });
      setDeleteTarget(null);
      await loadInstancesWorkspace();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Infrastructure"
        title="Instances"
        description="Manage environments across the projects visible to your role."
        metadata={!isAdmin ? <ScopeNotice tone="info">Showing assigned projects only</ScopeNotice> : undefined}
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditorMode("create");
              setEditorTarget(null);
              setEditorError(null);
            }}
          >
            Create instance
          </Button>
        }
      />

      {error ? <Alert tone="warning" title="Unable to refresh instances" description={error} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Instances" value={instances.length} icon={<ServerCog className="h-5 w-5" />} />
        <StatCard label="Projects" value={projects.length} icon={<ServerCog className="h-5 w-5" />} />
        <StatCard label="Active production" value={instances.filter((instance) => instance.type === "production" && instance.status === "active").length} icon={<ServerCog className="h-5 w-5" />} />
      </div>

      <Card className="space-y-5 p-5">
        <Alert
          title="Production rule"
          description="Only one active production instance is permitted per project. The create and edit flows validate this rule before saving."
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search instances"
          />
          {isAdmin ? (
            <Select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="">All projects</option>
            {filteredProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
          <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">All types</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </Select>
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        {editorError ? <Alert tone="danger" title="Instance validation" description={editorError} /> : null}

        <DataTable
          columns={columns}
          loading={loading}
          rows={filteredInstances}
          emptyState={
            <EmptyState
              title={query || clientFilter || projectFilter || typeFilter || statusFilter ? "No instances match the current filters" : "No instances yet"}
              description={
                query || clientFilter || projectFilter || typeFilter || statusFilter
                  ? "Clear or broaden the current filters."
                  : "Create the first instance to begin managing environments."
              }
              action={
                !query && !clientFilter && !projectFilter && !typeFilter && !statusFilter ? (
                  <Button onClick={() => setEditorMode("create")}>Create instance</Button>
                ) : undefined
              }
            />
          }
        />
      </Card>

      <InstanceFormSheet
        key={`${editorMode ?? "closed"}-${editorTarget?.id ?? "new"}-${String(editorMode !== null)}`}
        allowProjectSelection={editorMode === "create"}
        error={editorError}
        initialValue={
          editorMode === "edit" && editorTarget
            ? {
                name: editorTarget.name,
                projectId: String(editorTarget.project_id),
                status: editorTarget.status,
                type: editorTarget.type,
                url: editorTarget.url ?? "",
              }
            : undefined
        }
        loading={editorLoading}
        mode={editorMode === "edit" ? "edit" : "create"}
        onClose={() => {
          setEditorMode(null);
          setEditorTarget(null);
          setEditorError(null);
        }}
        onSubmit={handleInstanceSubmit}
        open={editorMode !== null}
        productionHint="If another production instance is already active in the selected project, you must deactivate it first."
        projects={projects}
      />

      <ConfirmDialog
        confirmLabel="Delete instance"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}. This action cannot be undone.`
            : ""
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        open={Boolean(deleteTarget)}
        title="Delete instance"
      />
    </div>
  );
}

"use client";

import { useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus, ServerCog, UsersRound } from "lucide-react";

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
import { useToast } from "@/components/ui/toast-provider";
import { useSession } from "@/features/auth/session-context";
import { ProjectFormSheet } from "@/features/projects/project-form-sheet";
import { countActiveProduction, formatDateTime } from "@/lib/format";
import { canCreateProjects, canDeleteProjects, canManageProjects } from "@/lib/permissions";
import { flattenProjectInstances } from "@/lib/records";
import {
  createProject,
  deleteProject,
  getClients,
  getErrorMessage,
  getProjects,
  isUnauthorizedError,
  updateProject,
} from "@/services/api";
import type { Client, ProjectWorkspace } from "@/types/api";

export function ProjectsPage() {
  const { isAdmin, signOut, token, user } = useSession();
  const { pushToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [sheetMode, setSheetMode] = useState<"create" | "edit" | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectWorkspace | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectWorkspace | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  async function loadProjectsWorkspace() {
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

  const loadProjectsWorkspaceOnMount = useEffectEvent(() => {
    void loadProjectsWorkspace();
  });

  useEffect(() => {
    loadProjectsWorkspaceOnMount();
  }, [isAdmin, token]);

  if (error && !projects.length && !loading) {
    return <ErrorState description={error} onRetry={() => void loadProjectsWorkspace()} />;
  }

  const instances = flattenProjectInstances(projects);
  const assignmentCount = projects.reduce((sum, project) => sum + project.assignments.length, 0);
  const filteredProjects = projects.filter((project) => {
    const matchesClient = clientFilter ? String(project.client_id) === clientFilter : true;
    const matchesQuery = deferredQuery
      ? project.name.toLowerCase().includes(deferredQuery) ||
        (project.description ?? "").toLowerCase().includes(deferredQuery)
      : true;
    return matchesClient && matchesQuery;
  });

  const columns: TableColumn<ProjectWorkspace>[] = [
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
      key: "client",
      header: "Client",
      render: (project) => project.client.name,
    },
    {
      key: "instances",
      header: "Instances",
      render: (project) => project.instances.length,
    },
    {
      key: "production",
      header: "Active production",
      render: (project) => countActiveProduction(project.instances),
    },
    ...(isAdmin
      ? [
          {
            key: "assignments",
            header: "Assignments",
            render: (project: ProjectWorkspace) => project.assignments.length,
          } satisfies TableColumn<ProjectWorkspace>,
        ]
      : []),
    {
      key: "updated",
      header: "Updated",
      render: (project) => formatDateTime(project.updated_at),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-[1%] whitespace-nowrap",
      render: (project) => (
        <div className="flex items-center gap-2">
          <Link href={`/projects/${project.id}`}>
            <Button variant="secondary" size="sm">
              Open
            </Button>
          </Link>
          {canManageProjects(user) ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedProject(project);
                  setSheetError(null);
                  setSheetMode("edit");
                }}
              >
                Edit
              </Button>
              {canDeleteProjects(user) ? (
                <Button variant="danger" size="sm" onClick={() => setDeleteTarget(project)}>
                  Delete
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      ),
    },
  ];

  async function handleProjectSubmit(value: {
    clientId: string;
    description: string;
    name: string;
  }) {
    if (!token) return;

    setSheetLoading(true);
    setSheetError(null);

    try {
      if (sheetMode === "edit" && selectedProject) {
        await updateProject(token, selectedProject.id, {
          ...(isAdmin ? { client_id: Number(value.clientId) } : {}),
          description: value.description.trim() || null,
          name: value.name,
        });
        pushToast({
          title: "Project updated",
          description: `${value.name} is now saved.`,
          tone: "success",
        });
      } else {
        await createProject(token, {
          client_id: Number(value.clientId),
          description: value.description.trim() || null,
          name: value.name,
        });
        pushToast({
          title: "Project created",
          description: `${value.name} is now part of the workspace.`,
          tone: "success",
        });
      }

      setSheetMode(null);
      setSelectedProject(null);
      await loadProjectsWorkspace();
    } catch (submitError) {
      setSheetError(getErrorMessage(submitError));
    } finally {
      setSheetLoading(false);
    }
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return;

    try {
      await deleteProject(token, deleteTarget.id);
      pushToast({
        title: "Project deleted",
        description: `${deleteTarget.name} was removed.`,
        tone: "success",
      });
      setDeleteTarget(null);
      await loadProjectsWorkspace();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Projects"
        title={isAdmin ? "Projects" : "My projects"}
        description={
          isAdmin
            ? "Browse the full project portfolio, manage metadata, and jump into instance or access workflows."
            : "Projects in this list are limited to the assignments attached to your account."
        }
        metadata={!isAdmin ? <ScopeNotice tone="info">Showing assigned projects only</ScopeNotice> : undefined}
        actions={
          canCreateProjects(user) ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setSheetMode("create")}>
              Create project
            </Button>
          ) : undefined
        }
      />

      {error ? <Alert tone="warning" title="Unable to refresh projects" description={error} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label={isAdmin ? "Projects" : "Assigned projects"} value={projects.length} icon={<FolderKanban className="h-5 w-5" />} />
        <StatCard label="Instances" value={instances.length} icon={<ServerCog className="h-5 w-5" />} />
        <StatCard label={isAdmin ? "Assignments" : "Role"} value={isAdmin ? assignmentCount : user?.role === "admin" ? "Admin" : "Standard"} icon={<UsersRound className="h-5 w-5" />} />
      </div>

      <Card className="space-y-5 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Project list</h2>
            <p className="mt-1 text-sm text-slate-500">Search, filter, and open individual project workspaces.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[32rem]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
            />
            <Select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <DataTable
          columns={columns}
          loading={loading}
          rows={filteredProjects}
          emptyState={
            <EmptyState
              title={query || clientFilter ? "No projects match the current filters" : isAdmin ? "No projects yet" : "No assigned projects yet"}
              description={
                query || clientFilter
                  ? "Clear or broaden the current filters."
                  : isAdmin
                    ? "Create the first project to start managing client infrastructure."
                    : "No projects are assigned to your account right now."
              }
              action={
                isAdmin && !query && !clientFilter ? (
                  <Button onClick={() => setSheetMode("create")}>Create project</Button>
                ) : undefined
              }
            />
          }
        />
      </Card>

      {sheetMode === "edit" || canCreateProjects(user) ? (
        <>
          <ProjectFormSheet
            key={`${sheetMode ?? "closed"}-${selectedProject?.id ?? "new"}-${String(sheetMode !== null)}`}
            allowClientSelection={isAdmin}
            clients={clients}
            error={sheetError}
            initialValue={
              selectedProject
                ? {
                    clientId: String(selectedProject.client_id),
                    description: selectedProject.description ?? "",
                    name: selectedProject.name,
                  }
                : undefined
            }
            loading={sheetLoading}
            mode={sheetMode === "edit" ? "edit" : "create"}
            onClose={() => {
              setSheetMode(null);
              setSelectedProject(null);
              setSheetError(null);
            }}
            onSubmit={handleProjectSubmit}
            open={sheetMode !== null}
          />

          {canDeleteProjects(user) ? (
            <ConfirmDialog
              confirmLabel="Delete project"
              description={
                deleteTarget
                  ? `Delete ${deleteTarget.name} and its instances. This action cannot be undone.`
                  : ""
              }
              onClose={() => setDeleteTarget(null)}
              onConfirm={() => void handleDelete()}
              open={Boolean(deleteTarget)}
              title="Delete project"
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

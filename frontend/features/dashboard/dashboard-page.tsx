"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, FolderKanban, ServerCog, TrendingUp } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, ScopeNotice } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/page-state";
import { StatCard } from "@/components/ui/stat-card";
import { InstanceTypeBadge, RoleBadge, StatusBadge } from "@/components/ui/status-badge";
import { useSession } from "@/features/auth/session-context";
import { countActiveProduction, formatDateTime } from "@/lib/format";
import {
  byId,
  flattenProjectInstances,
  sortProjectsByUpdated,
  sortInstancesByUpdated,
} from "@/lib/records";
import {
  getBackendDbHealth,
  getBackendHealth,
  getClients,
  getErrorMessage,
  getProjects,
  isUnauthorizedError,
} from "@/services/api";
import type { BackendHealth, DatabaseHealth, ProjectWorkspace } from "@/types/api";

type DashboardState = {
  clients: number;
  database?: DatabaseHealth;
  projects: ProjectWorkspace[];
  service?: BackendHealth;
};

export function DashboardPage() {
  const { isAdmin, signOut, token, user } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DashboardState>({
    clients: 0,
    projects: [],
  });

  async function loadDashboard() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const [clients, projects, service, database] = await Promise.all([
        getClients(token),
        getProjects(token),
        getBackendHealth(),
        getBackendDbHealth(),
      ]);

      setState({
        clients: clients.length,
        database,
        projects,
        service,
      });
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

  const loadDashboardOnMount = useEffectEvent(() => {
    void loadDashboard();
  });

  useEffect(() => {
    loadDashboardOnMount();
  }, [isAdmin, token]);

  if (error && !state.projects.length && !loading) {
    return <ErrorState description={error} onRetry={() => void loadDashboard()} />;
  }

  const clientCount = state.clients;
  const projectCount = state.projects.length;
  const instances = flattenProjectInstances(state.projects);
  const instanceCount = instances.length;
  const activeProductionCount = countActiveProduction(instances);
  const activeInstanceCount = instances.filter((instance) => instance.status === "active").length;
  const recentProjects = sortProjectsByUpdated(state.projects).slice(0, 6);
  const recentInstances = sortInstancesByUpdated(instances).slice(0, 5);
  const assignmentsManaged = state.projects.reduce(
    (total, project) => total + project.assignments.length,
    0
  );

  const recentProjectColumns: TableColumn<ProjectWorkspace>[] = [
    {
      key: "project",
      header: "Project",
      render: (project) => (
        <div>
          <Link
            href={`/projects/${project.id}`}
            className="font-semibold text-[color:var(--foreground)] hover:text-[color:var(--primary)]"
          >
            {project.name}
          </Link>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {project.description ?? "No description provided."}
          </p>
        </div>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      render: (project) => formatDateTime(project.updated_at),
    },
    {
      key: "action",
      header: "Action",
      className: "w-[1%] whitespace-nowrap",
      render: (project) => (
        <Link href={`/projects/${project.id}`}>
          <Button variant="secondary" size="sm" icon={<ArrowRight className="h-4 w-4" />}>
            Open
          </Button>
        </Link>
      ),
    },
  ];

  const projectLookup = byId(state.projects);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title={isAdmin ? "Portfolio dashboard" : "Assigned project dashboard"}
        description={
          isAdmin
            ? "Track clients, project volume, environment activity, and access control from one operational surface."
            : "Your dashboard is scoped to the projects and environments currently assigned to you."
        }
      
        actions={
          <>
            <Link href="/projects">
              <Button variant="secondary">Open projects</Button>
            </Link>
            <Link href="/instances">
              <Button>Open instances</Button>
            </Link>
          </>
        }
      />

      {error ? (
        <Alert
          tone="warning"
          title="Some dashboard data could not be refreshed"
          description={error}
          action={
            <Button variant="secondary" size="sm" onClick={() => void loadDashboard()}>
              Retry
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={isAdmin ? "Clients" : "Visible clients"}
          value={clientCount}
          hint={
            isAdmin
              ? "All client accounts in the workspace."
              : "Only clients tied to assigned projects."
          }
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          label={isAdmin ? "Projects" : "Assigned projects"}
          value={projectCount}
          hint={isAdmin ? "Current project portfolio." : "Projects available to your role."}
          icon={<FolderKanban className="h-5 w-5" />}
        />
        <StatCard
          label="Instances"
          value={instanceCount}
          hint={`${activeInstanceCount} active across accessible projects.`}
          icon={<ServerCog className="h-5 w-5" />}
        />
        <StatCard
          label="Active production"
          value={activeProductionCount}
          hint={
            isAdmin
              ? "Single active production instance enforced per project."
              : "Production environments visible in your assigned scope."
          }
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_.9fr]">
        <Card>
          <CardHeader
            title={isAdmin ? "Recent project activity" : "Recent assigned projects"}
            description={
              isAdmin
                ? "Projects sorted by latest update time."
                : "The most recently updated projects in your assigned scope."
            }
          />
          <div className="p-5">
            <DataTable
              columns={recentProjectColumns}
              loading={loading}
              rows={recentProjects}
              emptyState={
                <EmptyState
                  title={isAdmin ? "No projects yet" : "No assigned projects yet"}
                  description={
                    isAdmin
                      ? "Create a project to start managing instances and access."
                      : "You do not have any assigned projects yet. Contact an admin if this is unexpected."
                  }
                />
              }
            />
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Environment health"
              description="Current backend status and environment summary."
            />
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap gap-2">
                {isAdmin ? (
                  <Badge tone="info">{assignmentsManaged} assignments managed</Badge>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                  label="Production"
                  value={instances.filter((instance) => instance.type === "production").length}
                />
                <StatCard
                  label="Staging"
                  value={instances.filter((instance) => instance.type === "staging").length}
                />
                <StatCard
                  label="Development"
                  value={instances.filter((instance) => instance.type === "development").length}
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={isAdmin ? "Recent instance updates" : "Recent environment updates"}
              description="The most recently updated instances within your scope."
            />
            <div className="space-y-3 p-5">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-[color:var(--border)] p-4"
                    >
                      <div className="h-4 w-2/3 animate-pulse rounded bg-[color:var(--surface-muted)]" />
                    </div>
                  ))}
                </div>
              ) : recentInstances.length ? (
                recentInstances.map((instance) => {
                  const project = projectLookup[instance.project_id];

                  return (
                    <div
                      key={instance.id}
                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--foreground)]">
                            {instance.name}
                          </p>
                          <p className="mt-1 text-sm text-[color:var(--muted)]">
                            {project?.name ?? "Unknown project"} | Updated{" "}
                            {formatDateTime(instance.updated_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <InstanceTypeBadge type={instance.type} />
                          <StatusBadge status={instance.status} />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  title="No instances yet"
                  description="Instance updates will appear here once projects start using environments."
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

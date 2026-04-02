"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { FolderKanban, Plus, ServerCog, Shield, UsersRound } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { UserDirectoryPicker } from "@/components/users/user-directory-picker";
import { Field } from "@/components/ui/field";
import { PageHeader, ScopeNotice } from "@/components/ui/page-header";
import { ErrorState, ForbiddenState, NotFoundState } from "@/components/ui/page-state";
import { StatCard } from "@/components/ui/stat-card";
import { InstanceTypeBadge, RoleBadge, StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-provider";
import { useSession } from "@/features/auth/session-context";
import { InstanceFormSheet, type InstanceFormValue } from "@/features/instances/instance-form-sheet";
import { getProductionConflictMessage } from "@/features/instances/production-rule";
import { ProjectFormSheet } from "@/features/projects/project-form-sheet";
import { countActiveProduction, formatDateTime } from "@/lib/format";
import { canManageAssignments, canManageProjects } from "@/lib/permissions";
import {
  createProjectAssignment,
  createProjectInstance,
  deleteProjectAssignment,
  deleteProjectInstance,
  getClients,
  getErrorMessage,
  getProject,
  isUnauthorizedError,
  updateProject,
  updateProjectInstance,
} from "@/services/api";
import type { Client, Instance, ProjectAssignment, ProjectWorkspace, UserSummary } from "@/types/api";

type DeleteState =
  | { kind: "instance"; instance: Instance }
  | { kind: "assignment"; assignment: ProjectAssignment }
  | null;

export function ProjectDetailPage({ projectId }: { projectId: number }) {
  const { isAdmin, signOut, token, user } = useSession();
  const { pushToast } = useToast();
  const [project, setProject] = useState<ProjectWorkspace | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [projectEditorOpen, setProjectEditorOpen] = useState(false);
  const [instanceEditorMode, setInstanceEditorMode] = useState<"create" | "edit" | null>(null);
  const [instanceEditorTarget, setInstanceEditorTarget] = useState<Instance | null>(null);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);
  const [instanceFormError, setInstanceFormError] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [savingInstance, setSavingInstance] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<UserSummary | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);

  async function loadWorkspace() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const [currentProject, visibleClients] = await Promise.all([
        getProject(token, projectId),
        getClients(token),
      ]);

      setProject(currentProject);
      setClients(visibleClients);
      setActiveTab((currentTab) => {
        if (currentTab === "access" && !isAdmin) return "overview";
        return currentTab;
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

  const loadWorkspaceOnMount = useEffectEvent(() => {
    void loadWorkspace();
  });

  useEffect(() => {
    loadWorkspaceOnMount();
  }, [isAdmin, projectId, token]);

  if (error?.toLowerCase().includes("not found")) return <NotFoundState />;
  if (error?.toLowerCase().includes("do not have access")) return <ForbiddenState />;
  if (error && !loading && !project) {
    return <ErrorState description={error} onRetry={() => void loadWorkspace()} />;
  }

  const instances = project?.instances ?? [];
  const assignments = project?.assignments ?? [];
  const activeProductionCount = countActiveProduction(instances);
  const assignedUserIds = assignments.map((assignment) => assignment.user.id);

  const instanceColumns: TableColumn<Instance>[] = [
    {
      key: "instance",
      header: "Instance",
      render: (instance) => (
        <div>
          <p className="font-semibold text-slate-900">{instance.name}</p>
          <p className="mt-1 text-sm text-slate-500">Updated {formatDateTime(instance.updated_at)}</p>
        </div>
      ),
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setInstanceEditorTarget(instance);
              setInstanceFormError(null);
              setInstanceEditorMode("edit");
            }}
          >
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteState({ kind: "instance", instance })}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const assignmentColumns: TableColumn<ProjectAssignment>[] = [
    {
      key: "user",
      header: "User",
      render: (assignment) => (
        <div>
          <p className="font-semibold text-slate-900">{assignment.user.name}</p>
          <p className="mt-1 text-sm text-slate-500">{assignment.user.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (assignment) => <RoleBadge role={assignment.user.role} />,
    },
    {
      key: "assigned",
      header: "Assigned",
      render: (assignment) => formatDateTime(assignment.created_at),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-[1%] whitespace-nowrap",
      render: (assignment) => (
        <Button
          variant="danger"
          size="sm"
          onClick={() => setDeleteState({ kind: "assignment", assignment })}
        >
          Remove
        </Button>
      ),
    },
  ];

  async function handleProjectSave(value: {
    clientId: string;
    description: string;
    name: string;
  }) {
    if (!token || !project) return;

    setSavingProject(true);
    setProjectFormError(null);

    try {
      await updateProject(token, project.id, {
        ...(isAdmin ? { client_id: Number(value.clientId) } : {}),
        description: value.description.trim() || null,
        name: value.name,
      });
      pushToast({
        title: "Project updated",
        description: `${value.name} is now saved.`,
        tone: "success",
      });
      setProjectEditorOpen(false);
      await loadWorkspace();
    } catch (saveError) {
      setProjectFormError(getErrorMessage(saveError));
    } finally {
      setSavingProject(false);
    }
  }

  async function handleInstanceSubmit(value: InstanceFormValue) {
    if (!token || !project) return;

    const conflictMessage = getProductionConflictMessage(
      instances,
      value,
      instanceEditorTarget?.id,
    );

    if (conflictMessage) {
      setInstanceFormError(conflictMessage);
      return;
    }

    setSavingInstance(true);
    setInstanceFormError(null);

    try {
      if (instanceEditorMode === "edit" && instanceEditorTarget) {
        await updateProjectInstance(token, instanceEditorTarget.id, {
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
        await createProjectInstance(token, project.id, {
          name: value.name,
          status: value.status,
          type: value.type,
          url: value.url || null,
        });
        pushToast({
          title: "Instance created",
          description: `${value.name} was added to this project.`,
          tone: "success",
        });
      }

      setInstanceEditorMode(null);
      setInstanceEditorTarget(null);
      await loadWorkspace();
    } catch (saveError) {
      setInstanceFormError(getErrorMessage(saveError));
    } finally {
      setSavingInstance(false);
    }
  }

  async function handleAssignmentCreate() {
    if (!token || !project || !selectedAssignee) return;

    setSavingAssignment(true);
    setAssignmentError(null);

    try {
      await createProjectAssignment(token, project.id, { user_id: selectedAssignee.id });
      pushToast({
        title: "Assignment created",
        description: "The user can now access this project.",
        tone: "success",
      });
      setSelectedAssignee(null);
      await loadWorkspace();
    } catch (assignmentCreateError) {
      setAssignmentError(getErrorMessage(assignmentCreateError));
    } finally {
      setSavingAssignment(false);
    }
  }

  async function handleDelete() {
    if (!token || !deleteState || !project) return;

    try {
      if (deleteState.kind === "instance") {
        await deleteProjectInstance(token, deleteState.instance.id);
        pushToast({
          title: "Instance deleted",
          description: `${deleteState.instance.name} was removed.`,
          tone: "success",
        });
      } else {
        await deleteProjectAssignment(token, project.id, deleteState.assignment.user.id);
        pushToast({
          title: "Assignment removed",
          description: `${deleteState.assignment.user.name} no longer has project access.`,
          tone: "success",
        });
      }

      setDeleteState(null);
      await loadWorkspace();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
          <Card>
            <CardHeader title="Project summary" description="Operational context for this project." />
            <div className="space-y-4 p-5">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Description</p>
                <p className="mt-2 text-sm text-slate-500">
                  {project?.description ?? "No project description has been added yet."}
                </p>
              </div>
              <Alert
                title="Production governance"
                description="A project may have multiple staging or development instances, but only one active production instance at a time."
              />
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Client context" description="The account this project belongs to." />
              <div className="space-y-4 p-5">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Client</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{project?.client.name ?? "Unknown client"}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Created</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{formatDateTime(project?.created_at)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Updated</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{formatDateTime(project?.updated_at)}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ),
    },
    {
      id: "instances",
      label: "Instances",
      content: (
        <Card>
          <CardHeader
            title="Instances"
            description="Manage environments for this project."
            action={
              <Button
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setInstanceFormError(null);
                  setInstanceEditorTarget(null);
                  setInstanceEditorMode("create");
                }}
              >
                Create instance
              </Button>
            }
          />
          <div className="space-y-5 p-5">
            {instanceFormError ? (
              <Alert tone="danger" title="Instance validation" description={instanceFormError} />
            ) : null}
            <DataTable
              columns={instanceColumns}
              loading={loading}
              rows={instances}
              emptyState={
                <EmptyState
                  title="No instances for this project"
                  description="Create the first environment to start tracking infrastructure for this project."
                  action={<Button onClick={() => setInstanceEditorMode("create")}>Create instance</Button>}
                />
              }
            />
          </div>
        </Card>
      ),
    },
    ...(canManageAssignments(user)
      ? [
          {
            id: "access",
            label: "Access",
            content: (
              <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
                <Card>
                  <CardHeader
                    title="Assignments"
                    description="Users who can access this project."
                  />
                  <div className="space-y-5 p-5">
                    <Alert
                      tone="info"
                      title="User directory note"
                      description="Search results come directly from the backend user directory and exclude users who already have project access."
                    />
                    <DataTable
                      columns={assignmentColumns}
                      loading={loading}
                      rows={assignments}
                      emptyState={
                        <EmptyState
                          title="No users assigned"
                          description="Create the first assignment to grant project visibility."
                        />
                      }
                    />
                  </div>
                </Card>

                <Card>
                  <CardHeader
                    title="Grant access"
                    description="Assign a user by searching the backend directory."
                  />
                  <div className="space-y-5 p-5">
                    {assignmentError ? (
                      <Alert tone="danger" title="Unable to create assignment" description={assignmentError} />
                    ) : null}
                    <Field label="User directory" hint="Already assigned users are filtered out automatically.">
                      <UserDirectoryPicker
                        disabledUserIds={assignedUserIds}
                        onSelect={setSelectedAssignee}
                        onUnauthorized={signOut}
                        selectedUserId={selectedAssignee?.id ?? null}
                        token={token}
                      />
                    </Field>
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        Selected user
                      </p>
                      <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">
                        {selectedAssignee?.name ?? "No user selected"}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {selectedAssignee?.email ?? "Choose a user from the directory to grant access."}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={() => void handleAssignmentCreate()}
                        disabled={!selectedAssignee || savingAssignment}
                      >
                        {savingAssignment ? "Assigning..." : "Create assignment"}
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project detail"
        title={project?.name ?? "Loading project"}
        description={project?.description ?? "No description has been set for this project."}
        metadata={
          <>
            <Badge tone="neutral">{project?.client.name ?? "Unknown client"}</Badge>
            <RoleBadge role={user?.role ?? "standard"} />
            {!isAdmin ? <ScopeNotice tone="info">Assigned project scope</ScopeNotice> : null}
          </>
        }
        actions={
          <>
            {canManageProjects(user) ? (
              <Button variant="secondary" onClick={() => setProjectEditorOpen(true)}>
                Edit project
              </Button>
            ) : null}
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setInstanceFormError(null);
                setInstanceEditorTarget(null);
                setInstanceEditorMode("create");
                setActiveTab("instances");
              }}
            >
              Create instance
            </Button>
          </>
        }
      />

      {error ? <Alert tone="warning" title="Workspace refresh issue" description={error} /> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Instances" value={instances.length} icon={<ServerCog className="h-5 w-5" />} />
        <StatCard label="Active production" value={activeProductionCount} icon={<Shield className="h-5 w-5" />} />
        <StatCard label="Assignments" value={isAdmin ? assignments.length : "Scoped"} icon={<UsersRound className="h-5 w-5" />} />
        <StatCard label="Project ID" value={project?.id ?? "..."} icon={<FolderKanban className="h-5 w-5" />} />
      </div>

      <Tabs items={tabs} onValueChange={setActiveTab} value={activeTab} />

      {canManageProjects(user) ? (
        <ProjectFormSheet
          key={`project-${project?.id ?? "unknown"}-${String(projectEditorOpen)}`}
          allowClientSelection={isAdmin}
          clients={clients}
          error={projectFormError}
          initialValue={
            project
              ? {
                  clientId: String(project.client_id),
                  description: project.description ?? "",
                  name: project.name,
                }
              : undefined
          }
          loading={savingProject}
          mode="edit"
          onClose={() => {
            setProjectEditorOpen(false);
            setProjectFormError(null);
          }}
          onSubmit={handleProjectSave}
          open={projectEditorOpen}
        />
      ) : null}

      <InstanceFormSheet
        key={`${instanceEditorMode ?? "closed"}-${instanceEditorTarget?.id ?? "new"}-${String(instanceEditorMode !== null)}`}
        allowProjectSelection={false}
        error={instanceFormError}
        initialValue={
          instanceEditorMode === "edit" && instanceEditorTarget
            ? {
                name: instanceEditorTarget.name,
                projectId: String(instanceEditorTarget.project_id),
                status: instanceEditorTarget.status,
                type: instanceEditorTarget.type,
                url: instanceEditorTarget.url ?? "",
              }
            : {
                projectId: String(project?.id ?? ""),
              }
        }
        loading={savingInstance}
        mode={instanceEditorMode === "edit" ? "edit" : "create"}
        onClose={() => {
          setInstanceEditorMode(null);
          setInstanceEditorTarget(null);
          setInstanceFormError(null);
        }}
        onSubmit={handleInstanceSubmit}
        open={instanceEditorMode !== null}
        productionHint="Only one active production instance is allowed for this project."
        projects={project ? [project] : []}
      />

      <ConfirmDialog
        confirmLabel={
          deleteState?.kind === "assignment" ? "Remove assignment" : "Delete instance"
        }
        description={
          deleteState?.kind === "assignment"
            ? `Remove ${deleteState.assignment.user.name} from this project.`
            : deleteState?.kind === "instance"
              ? `Delete ${deleteState.instance.name}. This action cannot be undone.`
              : ""
        }
        onClose={() => setDeleteState(null)}
        onConfirm={() => void handleDelete()}
        open={Boolean(deleteState)}
        title={deleteState?.kind === "assignment" ? "Remove assignment" : "Delete instance"}
      />
    </div>
  );
}

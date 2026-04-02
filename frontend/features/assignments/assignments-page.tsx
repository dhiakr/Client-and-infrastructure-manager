"use client";

import { useEffect, useEffectEvent, useState, type ChangeEvent } from "react";
import { Shield, UsersRound } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type TableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { UserDirectoryPicker } from "@/components/users/user-directory-picker";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, ForbiddenState } from "@/components/ui/page-state";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { RoleBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { useSession } from "@/features/auth/session-context";
import { formatDateTime } from "@/lib/format";
import {
  createProjectAssignment,
  deleteProjectAssignment,
  getClients,
  getErrorMessage,
  getProjects,
  isUnauthorizedError,
} from "@/services/api";
import type { Client, ProjectAssignment, ProjectWorkspace, UserSummary } from "@/types/api";

export function AssignmentsPage() {
  const { isAdmin, signOut, token } = useSession();
  const { pushToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectWorkspace[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<UserSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectAssignment | null>(null);

  async function loadScope() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const [nextClients, nextProjects] = await Promise.all([getClients(token), getProjects(token)]);
      setClients(nextClients);
      setProjects(nextProjects);
      setSelectedProjectId((currentValue) =>
        currentValue && nextProjects.some((project) => String(project.id) === currentValue)
          ? currentValue
          : String(nextProjects[0]?.id ?? ""),
      );
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

  const loadScopeOnMount = useEffectEvent(() => {
    void loadScope();
  });

  useEffect(() => {
    if (!isAdmin) return;
    loadScopeOnMount();
  }, [isAdmin, token]);

  function handleProjectChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextProjectId = event.target.value;

    setSelectedProjectId(nextProjectId);
    setSelectedAssignee(null);
  }

  if (!isAdmin) return <ForbiddenState />;
  if (error && !projects.length && !loading) {
    return <ErrorState description={error} onRetry={() => void loadScope()} />;
  }

  const selectedProject = projects.find((project) => String(project.id) === selectedProjectId) ?? null;
  const selectedClient = clients.find((client) => client.id === selectedProject?.client_id) ?? null;
  const assignments = selectedProject?.assignments ?? [];
  const assignedUserIds = assignments.map((assignment) => assignment.user.id);

  const columns: TableColumn<ProjectAssignment>[] = [
    {
      key: "user",
      header: "User",
      render: (assignment) => (
        <div>
          <p className="font-semibold text-[color:var(--foreground)]">{assignment.user.name}</p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">{assignment.user.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (assignment) => <RoleBadge role={assignment.user.role} />,
    },
    {
      key: "created",
      header: "Assigned",
      render: (assignment) => formatDateTime(assignment.created_at),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-[1%] whitespace-nowrap",
      render: (assignment) => (
        <Button variant="danger" size="sm" onClick={() => setDeleteTarget(assignment)}>
          Remove
        </Button>
      ),
    },
  ];

  async function handleCreateAssignment() {
    if (!token || !selectedProjectId || !selectedAssignee) return;

    setAssignmentsLoading(true);
    setAssignmentError(null);

    try {
      await createProjectAssignment(token, Number(selectedProjectId), {
        user_id: selectedAssignee.id,
      });
      pushToast({
        title: "Assignment created",
        description: "The user can now access this project.",
        tone: "success",
      });
      setSelectedAssignee(null);
      await loadScope();
    } catch (createError) {
      if (isUnauthorizedError(createError)) {
        signOut();
        return;
      }

      setAssignmentError(getErrorMessage(createError));
    } finally {
      setAssignmentsLoading(false);
    }
  }

  async function handleDelete() {
    if (!token || !deleteTarget || !selectedProjectId) return;

    try {
      await deleteProjectAssignment(token, Number(selectedProjectId), deleteTarget.user.id);
      pushToast({
        title: "Assignment removed",
        description: `${deleteTarget.user.name} no longer has access.`,
        tone: "success",
      });
      setDeleteTarget(null);
      await loadScope();
    } catch (deleteError) {
      if (isUnauthorizedError(deleteError)) {
        signOut();
        return;
      }

      setAssignmentError(getErrorMessage(deleteError));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access control"
        title="Assignments"
        description="Admin-only control panel for project visibility and assignment changes."
      />

      {error ? <Alert tone="warning" title="Unable to load assignment scope" description={error} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Projects" value={projects.length} icon={<Shield className="h-5 w-5" />} />
        <StatCard label="Current assignments" value={assignments.length} icon={<UsersRound className="h-5 w-5" />} />
        <StatCard label="Clients" value={clients.length} icon={<UsersRound className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <CardHeader
            title="Project assignments"
            description="Select a project to review who currently has access."
          />
          <div className="space-y-5 p-5">
            <Select value={selectedProjectId} onChange={handleProjectChange}>
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>

            {assignmentError ? (
              <Alert tone="danger" title="Assignment workflow issue" description={assignmentError} />
            ) : null}

            <DataTable
              columns={columns}
              loading={assignmentsLoading || loading}
              rows={assignments}
              emptyState={
                <EmptyState
                  title={selectedProject ? "No users assigned" : "No project selected"}
                  description={
                    selectedProject
                      ? "Assign a user to grant access to this project."
                      : "Select a project to review and manage its assignments."
                  }
                />
              }
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Grant access"
            description="Search the backend user directory and assign access without relying on browser-local history."
          />
          <div className="space-y-5 p-5">
            <Alert
              title="User directory note"
              description="Results below come directly from the backend user directory and update as you search by name or email."
            />

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Selected project
              </p>
              <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">
                {selectedProject?.name ?? "No project selected"}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">{selectedClient?.name ?? "Client unavailable"}</p>
            </div>

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
                onClick={() => void handleCreateAssignment()}
                disabled={!selectedProjectId || !selectedAssignee || assignmentsLoading}
              >
                {assignmentsLoading ? "Assigning..." : "Create assignment"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        confirmLabel="Remove assignment"
        description={deleteTarget ? `Remove ${deleteTarget.user.name} from this project.` : ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        open={Boolean(deleteTarget)}
        title="Remove assignment"
      />
    </div>
  );
}

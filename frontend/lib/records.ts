import type { Client, Instance, Project, ProjectAssignment, ProjectWorkspace } from "@/types/api";

export function byId<T extends { id: number }>(items: T[]) {
  return Object.fromEntries(items.map((item) => [item.id, item])) as Record<number, T>;
}

export function groupProjectsByClient<T extends Project>(projects: T[]) {
  return projects.reduce<Record<number, T[]>>((accumulator, project) => {
    accumulator[project.client_id] ??= [];
    accumulator[project.client_id].push(project);
    return accumulator;
  }, {} as Record<number, T[]>);
}

export function groupInstancesByProject(instances: Instance[]) {
  return instances.reduce<Record<number, Instance[]>>((accumulator, instance) => {
    accumulator[instance.project_id] ??= [];
    accumulator[instance.project_id].push(instance);
    return accumulator;
  }, {});
}

export function countProjectAssignments(assignmentsByProject: Record<number, ProjectAssignment[]>) {
  return Object.fromEntries(
    Object.entries(assignmentsByProject).map(([projectId, assignments]) => [
      Number(projectId),
      assignments.length,
    ]),
  ) as Record<number, number>;
}

export function sortProjectsByUpdated<T extends Project>(projects: T[]) {
  return [...projects].sort(
    (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
  );
}

export function sortInstancesByUpdated(instances: Instance[]) {
  return [...instances].sort(
    (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
  );
}

export function getClientProjects(client: Client, projectsByClient: Record<number, Project[]>) {
  return projectsByClient[client.id] ?? [];
}

export function flattenProjectInstances(projects: ProjectWorkspace[]) {
  return projects.flatMap((project) => project.instances);
}

export function flattenProjectAssignments(projects: ProjectWorkspace[]) {
  return projects.flatMap((project) => project.assignments);
}

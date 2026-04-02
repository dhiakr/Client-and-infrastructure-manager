import type { CurrentUser } from "@/types/api";

export function isAdmin(user: CurrentUser | null) {
  return user?.role === "admin";
}

export function canManageClients(user: CurrentUser | null) {
  return isAdmin(user);
}

export function canManageProjects(user: CurrentUser | null) {
  return Boolean(user);
}

export function canCreateProjects(user: CurrentUser | null) {
  return isAdmin(user);
}

export function canDeleteProjects(user: CurrentUser | null) {
  return isAdmin(user);
}

export function canManageAssignments(user: CurrentUser | null) {
  return isAdmin(user);
}

export function canViewClientsSection(user: CurrentUser | null) {
  return isAdmin(user);
}

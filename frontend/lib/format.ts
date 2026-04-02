import type { CurrentUser, Instance, InstanceStatus, InstanceType, UserRole } from "@/types/api";

export function formatDateTime(value: string | undefined) {
  if (!value) return "n/a";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value: string | undefined) {
  if (!value) return "n/a";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function humanize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function roleLabel(role: UserRole) {
  return role === "admin" ? "Admin" : "Standard user";
}

export function roleDescription(user: CurrentUser) {
  return user.role === "admin" ? "Full platform access" : "Assigned project access";
}

export function instanceTypeTone(type: InstanceType) {
  if (type === "production") return "danger" as const;
  if (type === "staging") return "info" as const;
  return "neutral" as const;
}

export function instanceStatusTone(status: InstanceStatus) {
  return status === "active" ? "success" : "warning";
}

export function countActiveProduction(instances: Instance[]) {
  return instances.filter((instance) => instance.type === "production" && instance.status === "active")
    .length;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

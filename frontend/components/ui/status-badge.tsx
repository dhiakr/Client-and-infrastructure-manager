import type { InstanceStatus, InstanceType, UserRole } from "@/types/api";

import { Badge } from "@/components/ui/badge";
import { humanize, instanceStatusTone, instanceTypeTone, roleLabel } from "@/lib/format";

export function InstanceTypeBadge({ type }: { type: InstanceType }) {
  return <Badge tone={instanceTypeTone(type)}>{humanize(type)}</Badge>;
}

export function StatusBadge({ status }: { status: InstanceStatus }) {
  return <Badge tone={instanceStatusTone(status)}>{humanize(status)}</Badge>;
}

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge tone={role === "admin" ? "info" : "neutral"}>{roleLabel(role)}</Badge>;
}

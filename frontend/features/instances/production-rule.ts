import type { InstanceFormValue } from "@/features/instances/instance-form-sheet";
import type { Instance } from "@/types/api";

export function getProductionConflictMessage(
  instances: Instance[],
  value: Pick<InstanceFormValue, "status" | "type">,
  editingInstanceId?: number,
) {
  if (!(value.type === "production" && value.status === "active")) {
    return null;
  }

  const existingProduction = instances.find(
    (instance) =>
      instance.type === "production" &&
      instance.status === "active" &&
      instance.id !== editingInstanceId,
  );

  if (!existingProduction) return null;

  return `This project already has an active production instance${
    existingProduction.name ? ` (${existingProduction.name})` : ""
  }. Deactivate the current production instance before creating or activating another.`;
}

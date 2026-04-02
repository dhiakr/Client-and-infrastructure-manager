"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import type { InstanceStatus, InstanceType, Project } from "@/types/api";

export type InstanceFormValue = {
  name: string;
  projectId: string;
  status: InstanceStatus;
  type: InstanceType;
  url: string;
};

const defaultInstanceValue: InstanceFormValue = {
  name: "",
  projectId: "",
  status: "active",
  type: "staging",
  url: "",
};

function buildInstanceFormValue(projects: Project[], initialValue?: Partial<InstanceFormValue>) {
  return {
    ...defaultInstanceValue,
    projectId: projects[0] ? String(projects[0].id) : "",
    ...initialValue,
  };
}

export function InstanceFormSheet({
  allowProjectSelection,
  error,
  initialValue,
  loading,
  mode,
  onClose,
  onSubmit,
  open,
  productionHint,
  projects,
}: {
  allowProjectSelection: boolean;
  error?: string | null;
  initialValue?: Partial<InstanceFormValue>;
  loading?: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  onSubmit: (value: InstanceFormValue) => Promise<void>;
  open: boolean;
  productionHint?: string;
  projects: Project[];
}) {
  const [value, setValue] = useState<InstanceFormValue>(() =>
    buildInstanceFormValue(projects, initialValue),
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      ...value,
      name: value.name.trim(),
      url: value.url.trim(),
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create instance" : "Edit instance"}
      description="Production environments are limited to one active instance per project."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="instance-form" type="submit" disabled={loading}>
            {loading ? "Saving..." : mode === "create" ? "Create instance" : "Save changes"}
          </Button>
        </div>
      }
    >
      <form id="instance-form" className="space-y-6" onSubmit={handleSubmit}>
        <FieldGroup title="Instance settings" description="Use clear names and accurate environment types so production risk is obvious in tables.">
          {allowProjectSelection ? (
            <Field label="Project" required>
              <Select
                value={value.projectId}
                onChange={(event) =>
                  setValue((currentValue) => ({ ...currentValue, projectId: event.target.value }))
                }
                required
              >
                <option value="" disabled>
                  Select a project
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field label="Instance name" required error={error}>
            <Input
              value={value.name}
              onChange={(event) =>
                setValue((currentValue) => ({ ...currentValue, name: event.target.value }))
              }
              maxLength={255}
              placeholder="Production EU"
              required
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Type"
              required
              hint={productionHint ?? "Production is visually emphasised and validated against the single-active rule."}
            >
              <Select
                value={value.type}
                onChange={(event) =>
                  setValue((currentValue) => ({
                    ...currentValue,
                    type: event.target.value as InstanceType,
                  }))
                }
                required
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </Select>
            </Field>
            <Field label="Status" required>
              <Select
                value={value.status}
                onChange={(event) =>
                  setValue((currentValue) => ({
                    ...currentValue,
                    status: event.target.value as InstanceStatus,
                  }))
                }
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
          </div>

          <Field label="Instance URL" hint="Optional, but useful for direct environment access from the workspace.">
            <Input
              type="url"
              value={value.url}
              onChange={(event) =>
                setValue((currentValue) => ({ ...currentValue, url: event.target.value }))
              }
              placeholder="https://odoo.example.com"
            />
          </Field>
        </FieldGroup>
      </form>
    </Sheet>
  );
}

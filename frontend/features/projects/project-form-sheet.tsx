"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/types/api";

type ProjectFormValue = {
  clientId: string;
  description: string;
  name: string;
};

function buildProjectFormValue(clients: Client[], initialValue?: ProjectFormValue) {
  return (
    initialValue ?? {
      clientId: clients[0] ? String(clients[0].id) : "",
      description: "",
      name: "",
    }
  );
}

export function ProjectFormSheet({
  allowClientSelection = true,
  clients,
  error,
  initialValue,
  loading,
  mode,
  onClose,
  onSubmit,
  open,
}: {
  allowClientSelection?: boolean;
  clients: Client[];
  error?: string | null;
  initialValue?: ProjectFormValue;
  loading?: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  onSubmit: (value: ProjectFormValue) => Promise<void>;
  open: boolean;
}) {
  const [value, setValue] = useState<ProjectFormValue>(() => buildProjectFormValue(clients, initialValue));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      clientId: value.clientId,
      description: value.description,
      name: value.name.trim(),
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create project" : "Edit project"}
      description="Projects are the main operational unit and can contain multiple development or staging instances."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="project-form" type="submit" disabled={loading}>
            {loading ? "Saving..." : mode === "create" ? "Create project" : "Save changes"}
          </Button>
        </div>
      }
    >
      <form id="project-form" className="space-y-6" onSubmit={handleSubmit}>
        <FieldGroup title="Project information" description="Keep project metadata clear and operationally focused.">
          <Field
            label="Client"
            required
            hint={!allowClientSelection ? "Assigned users can edit project metadata but cannot move projects between clients." : undefined}
          >
            <Select
              disabled={!allowClientSelection}
              value={value.clientId}
              onChange={(event) =>
                setValue((currentValue) => ({ ...currentValue, clientId: event.target.value }))
              }
              required
            >
              <option value="" disabled>
                Select a client
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project name" required error={error}>
            <Input
              value={value.name}
              onChange={(event) =>
                setValue((currentValue) => ({ ...currentValue, name: event.target.value }))
              }
              minLength={2}
              maxLength={255}
              placeholder="Northwind ERP rollout"
              required
            />
          </Field>
          <Field label="Description" hint="Optional context shown on the detail page and dashboard summaries.">
            <Textarea
              value={value.description}
              onChange={(event) =>
                setValue((currentValue) => ({ ...currentValue, description: event.target.value }))
              }
              placeholder="Briefly describe the implementation scope, client domain, or operational notes."
            />
          </Field>
        </FieldGroup>
      </form>
    </Sheet>
  );
}

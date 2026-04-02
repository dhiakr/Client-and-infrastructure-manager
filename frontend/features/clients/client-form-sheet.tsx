"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";

export function ClientFormSheet({
  error,
  initialName = "",
  loading,
  mode,
  onClose,
  onSubmit,
  open,
}: {
  error?: string | null;
  initialName?: string;
  loading?: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  open: boolean;
}) {
  const [name, setName] = useState(initialName);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(name.trim());
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create client" : "Edit client"}
      description="Client records organise the project portfolio and access scope."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="client-form" type="submit" disabled={loading}>
            {loading ? "Saving..." : mode === "create" ? "Create client" : "Save changes"}
          </Button>
        </div>
      }
    >
      <form id="client-form" className="space-y-6" onSubmit={handleSubmit}>
        <FieldGroup title="Client information" description="Use a concise account name for easy scanning in tables and filters.">
          <Field label="Client name" required error={error}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={255}
              placeholder="Acme Group"
              required
            />
          </Field>
        </FieldGroup>
      </form>
    </Sheet>
  );
}

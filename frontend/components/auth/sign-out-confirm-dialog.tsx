"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function SignOutConfirmDialog({
  onClose,
  onConfirm,
  open,
}: {
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
}) {
  return (
    <ConfirmDialog
      confirmLabel="Sign out"
      description="You will be returned to the sign-in screen and need to authenticate again to continue."
      onClose={onClose}
      onConfirm={onConfirm}
      open={open}
      title="Sign out?"
    />
  );
}

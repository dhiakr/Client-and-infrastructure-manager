import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function EmptyState({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <Card className="border-dashed bg-slate-50/80 p-8 text-center">
      {icon ? <div className="mx-auto mb-4 flex w-fit items-center justify-center">{icon}</div> : null}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  );
}

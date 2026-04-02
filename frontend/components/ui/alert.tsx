import type { ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/cn";

type AlertTone = "info" | "warning" | "danger";

export function Alert({
  title,
  description,
  tone = "info",
  action,
}: {
  title: string;
  description?: ReactNode;
  tone?: AlertTone;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        tone === "info" && "border-[#bfd6ff] bg-[#eaf2ff] text-[#103d8b]",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-900",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {tone === "warning" ? (
              <TriangleAlert className="h-4 w-4" />
            ) : tone === "danger" ? (
              <CircleAlert className="h-4 w-4" />
            ) : (
              <Info className="h-4 w-4" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            {description ? <div className="mt-1 text-sm opacity-80">{description}</div> : null}
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

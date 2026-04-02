import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export function Tabs({
  items,
  value,
  onValueChange,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const activeItem = items.find((item) => item.id === value) ?? items[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              item.id === activeItem.id
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
            )}
            onClick={() => onValueChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div>{activeItem.content}</div>
    </div>
  );
}

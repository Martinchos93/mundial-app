"use client";

import { useMe } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Horizontal prode (group) switcher. Hidden when the user has <2 active prodes. */
export default function ProdeSwitcher({
  value,
  onChange,
  className,
}: {
  value: number | null;
  onChange: (groupId: number) => void;
  className?: string;
}) {
  const { data: me } = useMe();
  const prodes = (me?.memberships ?? []).filter((m) => m.status === "active");
  if (prodes.length <= 1) return null;

  return (
    <div className={cn("flex items-center gap-1.5 overflow-x-auto", className)}>
      <span className="flex-none text-[11px] font-medium text-gray-400">Prode:</span>
      {prodes.map((p) => (
        <button
          key={p.group_id}
          onClick={() => onChange(p.group_id)}
          className={cn(
            "flex-none rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
            value === p.group_id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
          )}
        >
          {p.group_name}
        </button>
      ))}
    </div>
  );
}

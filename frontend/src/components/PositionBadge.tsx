import { cn } from "@/lib/utils";

// Single source of truth for player-position display across the whole site.
export const POS_META: Record<string, { label: string; cls: string; order: number }> = {
  FW: { label: "DEL", cls: "bg-red-50 text-red-500", order: 0 },
  Attacker: { label: "DEL", cls: "bg-red-50 text-red-500", order: 0 },
  MF: { label: "MED", cls: "bg-amber-50 text-amber-600", order: 1 },
  Midfielder: { label: "MED", cls: "bg-amber-50 text-amber-600", order: 1 },
  DF: { label: "DEF", cls: "bg-blue-50 text-blue-500", order: 2 },
  Defender: { label: "DEF", cls: "bg-blue-50 text-blue-500", order: 2 },
  GK: { label: "ARQ", cls: "bg-gray-100 text-gray-500", order: 3 },
  Goalkeeper: { label: "ARQ", cls: "bg-gray-100 text-gray-500", order: 3 },
};

export const posMeta = (pos: string | null | undefined) =>
  POS_META[pos || ""] ?? { label: "", cls: "bg-gray-100 text-gray-400", order: 4 };

/** Sort comparator: forwards first, then by shirt number. */
export const byPosition = <T extends { position: string | null; number?: number | null }>(a: T, b: T) =>
  posMeta(a.position).order - posMeta(b.position).order || (a.number ?? 99) - (b.number ?? 99);

export default function PositionBadge({ position, className }: { position: string | null | undefined; className?: string }) {
  const m = posMeta(position);
  if (!m.label) return null;
  return (
    <span className={cn("flex-none rounded px-1 py-px text-[8.5px] font-bold tracking-wide", m.cls, className)}>
      {m.label}
    </span>
  );
}

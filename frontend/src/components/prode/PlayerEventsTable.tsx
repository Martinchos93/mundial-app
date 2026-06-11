"use client";

import { Minus, Plus } from "lucide-react";
import { useSquad, type SquadPlayer } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PlayerEvent } from "@/types";

export type EventMap = Record<string, PlayerEvent>;

interface Props {
  homeTeam: string;
  awayTeam: string;
  value: EventMap;
  onChange: (next: EventMap) => void;
  disabled?: boolean;
  maxGoals?: number;
  /** Max players that can carry a goal / a card (anti-gaming). Infinity = no cap. */
  maxPicks?: number;
}

function MiniStepper({
  value,
  onChange,
  disabled,
  disablePlus,
  max,
  tone,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  disablePlus?: boolean;
  max: number;
  tone: "goal" | "yellow" | "red";
}) {
  const active = value > 0;
  const toneCls = active
    ? tone === "goal"
      ? "text-blue-600"
      : tone === "yellow"
        ? "text-amber-500"
        : "text-red-500"
    : "text-gray-300";
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 disabled:opacity-30"
      >
        <Minus className="h-2.5 w-2.5" />
      </button>
      <span className={cn("w-3 text-center text-[13px] font-semibold tabular-nums", toneCls)}>{value}</span>
      <button
        type="button"
        disabled={disabled || value >= max || disablePlus}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 disabled:opacity-30"
      >
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

export default function PlayerEventsTable({
  homeTeam,
  awayTeam,
  value,
  onChange,
  disabled,
  maxGoals = 5,
  maxPicks = Infinity,
}: Props) {
  const { data: home } = useSquad(homeTeam || null);
  const { data: away } = useSquad(awayTeam || null);

  const capped = Number.isFinite(maxPicks);
  const goalUsed = Object.values(value).filter((e) => (e.g ?? 0) > 0).length;
  const cardUsed = Object.values(value).filter((e) => (e.y ?? 0) > 0 || (e.r ?? 0) > 0).length;

  function setField(p: SquadPlayer, team: string, field: "g" | "y" | "r", v: number) {
    const cur = value[p.name] ?? { name: p.name, team, g: 0, y: 0, r: 0 };
    onChange({ ...value, [p.name]: { ...cur, name: p.name, team, [field]: v } });
  }

  const Section = ({ team, players }: { team: string; players?: SquadPlayer[] }) => (
    <>
      <tr className="bg-gray-50">
        <td colSpan={4} className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {team}
        </td>
      </tr>
      {!players && (
        <tr>
          <td colSpan={4} className="px-2.5 py-2 text-[11px] text-gray-300">
            Cargando plantel…
          </td>
        </tr>
      )}
      {(players ?? []).map((p) => {
        const ev = value[p.name];
        const g = ev?.g ?? 0;
        const y = ev?.y ?? 0;
        const r = ev?.r ?? 0;
        const touched = g || y || r;
        const goalAtCap = capped && g === 0 && goalUsed >= maxPicks;
        const cardAtCap = capped && y === 0 && r === 0 && cardUsed >= maxPicks;
        return (
          <tr key={p.id} className={cn("border-t border-gray-50", touched && "bg-blue-50/30")}>
            <td className="px-2.5 py-1.5">
              <span className="flex items-center gap-1.5">
                {p.number != null && <span className="w-5 text-[10px] text-gray-400">{p.number}</span>}
                <span className="text-[12px] text-gray-800">{p.name}</span>
              </span>
            </td>
            <td className="px-1 py-1.5">
              <MiniStepper tone="goal" max={maxGoals} disabled={disabled} disablePlus={goalAtCap} value={g} onChange={(v) => setField(p, team, "g", v)} />
            </td>
            <td className="px-1 py-1.5">
              <MiniStepper tone="yellow" max={1} disabled={disabled} disablePlus={cardAtCap} value={y} onChange={(v) => setField(p, team, "y", v)} />
            </td>
            <td className="px-1 py-1.5">
              <MiniStepper tone="red" max={1} disabled={disabled} disablePlus={cardAtCap} value={r} onChange={(v) => setField(p, team, "r", v)} />
            </td>
          </tr>
        );
      })}
    </>
  );

  return (
    <div>
      {capped && (
        <div className="mb-1 flex items-center justify-end gap-2 text-[10px] text-gray-400">
          <span className={cn(goalUsed >= maxPicks && "font-semibold text-blue-600")}>⚽ {goalUsed}/{maxPicks}</span>
          <span className={cn(cardUsed >= maxPicks && "font-semibold text-amber-600")}>🟨🟥 {cardUsed}/{maxPicks}</span>
        </div>
      )}
      <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-100">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="text-[9px] uppercase text-gray-400">
              <th className="px-2.5 py-1.5 text-left font-medium">Jugador</th>
              <th className="px-1 py-1.5 font-medium">⚽</th>
              <th className="px-1 py-1.5 font-medium">🟨</th>
              <th className="px-1 py-1.5 font-medium">🟥</th>
            </tr>
          </thead>
          <tbody>
            <Section team={homeTeam} players={home?.players} />
            <Section team={awayTeam} players={away?.players} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

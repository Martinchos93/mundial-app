"use client";

import { Fragment, memo, useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import { Minus, Plus } from "lucide-react";
import { useSquad, type SquadPlayer } from "@/lib/api";
import { cn } from "@/lib/utils";
import PositionBadge, { byPosition } from "@/components/PositionBadge";
import type { PlayerEvent } from "@/types";

export type EventMap = Record<string, PlayerEvent>;

interface Props {
  homeTeam: string;
  awayTeam: string;
  value: EventMap;
  onChange: Dispatch<SetStateAction<EventMap>>;
  disabled?: boolean;
  /** Predicted scoreline — goals assigned to each team's players can't exceed it. */
  homeGoals?: number;
  awayGoals?: number;
  /** Predicted match totals — yellow/red player picks can't exceed these (nor 3 per team). */
  maxYellowsTotal?: number;
  maxRedsTotal?: number;
}

const MAX_CARDS_PER_TEAM = 3;
const MAX_GOALS_PER_TEAM = 3; // goleadores por equipo = min(marcador, 3)

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

type SetField = (p: SquadPlayer, team: string, field: "g" | "y" | "r", v: number) => void;

// Memoized so a tap on one player only re-renders that row (not all ~52).
const PlayerRow = memo(function PlayerRow({
  player, team, g, y, r, goalMax, goalAtCap, yellowAtCap, redAtCap, disabled, onSet,
}: {
  player: SquadPlayer; team: string; g: number; y: number; r: number;
  goalMax: number; goalAtCap: boolean; yellowAtCap: boolean; redAtCap: boolean;
  disabled?: boolean; onSet: SetField;
}) {
  const touched = g || y || r;
  return (
    <tr className={cn("border-t border-gray-50", touched && "bg-blue-50/30")}>
      <td className="px-2.5 py-1.5">
        <span className="flex items-center gap-1.5">
          {player.number != null && <span className="w-5 flex-none text-[10px] text-gray-400">{player.number}</span>}
          <PositionBadge position={player.position} />
          <span className="truncate text-[12px] text-gray-800">{player.name}</span>
        </span>
      </td>
      <td className="px-1 py-1.5">
        <MiniStepper tone="goal" max={goalMax} disabled={disabled} disablePlus={goalAtCap} value={g} onChange={(v) => onSet(player, team, "g", v)} />
      </td>
      <td className="px-1 py-1.5">
        <MiniStepper tone="yellow" max={1} disabled={disabled} disablePlus={yellowAtCap} value={y} onChange={(v) => onSet(player, team, "y", v)} />
      </td>
      <td className="px-1 py-1.5">
        <MiniStepper tone="red" max={1} disabled={disabled} disablePlus={redAtCap} value={r} onChange={(v) => onSet(player, team, "r", v)} />
      </td>
    </tr>
  );
});

export default function PlayerEventsTable({
  homeTeam,
  awayTeam,
  value,
  onChange,
  disabled,
  homeGoals = Infinity,
  awayGoals = Infinity,
  maxYellowsTotal = Infinity,
  maxRedsTotal = Infinity,
}: Props) {
  const { data: home } = useSquad(homeTeam || null);
  const { data: away } = useSquad(awayTeam || null);

  // Stable setter (keeps PlayerRow memoization) that uses React's FUNCTIONAL
  // updater, so two quick taps on different players both land — a value-ref here
  // saw stale state between renders and silently dropped the first pick.
  const setField = useCallback<SetField>(
    (p, team, field, v) => {
      onChange((prev) => {
        const cur = prev[p.name] ?? { name: p.name, team, g: 0, y: 0, r: 0 };
        return { ...prev, [p.name]: { ...cur, name: p.name, team, [field]: v } };
      });
    },
    [onChange],
  );

  // Sort once per squad, not on every render.
  const homePlayers = useMemo(() => [...(home?.players ?? [])].sort(byPosition), [home]);
  const awayPlayers = useMemo(() => [...(away?.players ?? [])].sort(byPosition), [away]);

  const capped = [homeGoals, awayGoals, maxYellowsTotal, maxRedsTotal].some((n) => Number.isFinite(n));
  const vals = Object.values(value);
  const homeGoalSum = vals.filter((e) => e.team === homeTeam).reduce((s, e) => s + (e.g ?? 0), 0);
  const awayGoalSum = vals.filter((e) => e.team === awayTeam).reduce((s, e) => s + (e.g ?? 0), 0);
  const totalGoalSum = homeGoalSum + awayGoalSum;
  // Goleadores asignables por equipo = min(marcador, 3).
  const homeGoalCap = Number.isFinite(homeGoals) ? Math.min(homeGoals, MAX_GOALS_PER_TEAM) : Infinity;
  const awayGoalCap = Number.isFinite(awayGoals) ? Math.min(awayGoals, MAX_GOALS_PER_TEAM) : Infinity;
  const totalGoals = (Number.isFinite(homeGoalCap) ? homeGoalCap : 0) + (Number.isFinite(awayGoalCap) ? awayGoalCap : 0);

  const countCards = (team: string, field: "y" | "r") =>
    vals.filter((e) => e.team === team && (e[field] ?? 0) > 0).length;
  const homeYellowCount = countCards(homeTeam, "y");
  const awayYellowCount = countCards(awayTeam, "y");
  const totalYellowCount = homeYellowCount + awayYellowCount;
  const homeRedCount = countCards(homeTeam, "r");
  const awayRedCount = countCards(awayTeam, "r");
  const totalRedCount = homeRedCount + awayRedCount;
  const yellowsPerTeamCap = Number.isFinite(maxYellowsTotal) ? MAX_CARDS_PER_TEAM : Infinity;
  const redsPerTeamCap = Number.isFinite(maxRedsTotal) ? MAX_CARDS_PER_TEAM : Infinity;

  function renderSection(team: string, players: SquadPlayer[], loaded: boolean) {
    const teamGoalSum = team === homeTeam ? homeGoalSum : awayGoalSum;
    const teamGoalCap = team === homeTeam ? homeGoalCap : awayGoalCap;
    const teamYellowCount = team === homeTeam ? homeYellowCount : awayYellowCount;
    const teamRedCount = team === homeTeam ? homeRedCount : awayRedCount;
    const goalAtCap = teamGoalSum >= teamGoalCap;
    return (
      <Fragment key={team}>
        <tr className="bg-gray-50">
          <td colSpan={4} className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{team}</td>
        </tr>
        {!loaded && (
          <tr><td colSpan={4} className="px-2.5 py-2 text-[11px] text-gray-300">Cargando plantel…</td></tr>
        )}
        {players.map((p) => {
          const ev = value[p.name];
          const y = ev?.y ?? 0;
          const r = ev?.r ?? 0;
          return (
            <PlayerRow
              key={p.id}
              player={p}
              team={team}
              g={ev?.g ?? 0}
              y={y}
              r={r}
              goalMax={teamGoalCap}
              goalAtCap={goalAtCap}
              yellowAtCap={y === 0 && (teamYellowCount >= yellowsPerTeamCap || totalYellowCount >= maxYellowsTotal)}
              redAtCap={r === 0 && (teamRedCount >= redsPerTeamCap || totalRedCount >= maxRedsTotal)}
              disabled={disabled}
              onSet={setField}
            />
          );
        })}
      </Fragment>
    );
  }

  return (
    <div>
      {capped && (
        <div className="mb-1 flex items-center justify-end gap-2 text-[10px] text-gray-400">
          <span className={cn(totalGoalSum >= totalGoals && totalGoals > 0 && "font-semibold text-blue-600")}>⚽ {totalGoalSum}/{totalGoals}</span>
          <span className={cn(totalYellowCount >= maxYellowsTotal && maxYellowsTotal > 0 && "font-semibold text-amber-500")}>🟨 {totalYellowCount}/{Number.isFinite(maxYellowsTotal) ? maxYellowsTotal : "∞"}</span>
          <span className={cn(totalRedCount >= maxRedsTotal && maxRedsTotal > 0 && "font-semibold text-red-500")}>🟥 {totalRedCount}/{Number.isFinite(maxRedsTotal) ? maxRedsTotal : "∞"}</span>
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
            {renderSection(homeTeam, homePlayers, !!home)}
            {renderSection(awayTeam, awayPlayers, !!away)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

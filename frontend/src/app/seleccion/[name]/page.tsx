"use client";

import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import MatchCard from "@/components/match/MatchCard";
import { useStandings, useMatches, useSquad, type SquadPlayer } from "@/lib/api";
import PositionBadge from "@/components/PositionBadge";
import { flagFor } from "@/lib/flags";
import { parseISO } from "date-fns";
import type { Match } from "@/types";

const POS_EMOJI: Record<string, string> = {
  GK: "🧤", DF: "🛡️", MF: "🎯", FW: "⚽",
  Goalkeeper: "🧤", Defender: "🛡️", Midfielder: "🎯", Attacker: "⚽",
};
const POS_ES: Record<string, string> = {
  GK: "Arquero", DF: "Defensor", MF: "Mediocampista", FW: "Delantero",
  Goalkeeper: "Arquero", Defender: "Defensor", Midfielder: "Mediocampista", Attacker: "Delantero",
};

function PlayerAvatar({ p, size }: { p: SquadPlayer; size: string }) {
  return p.photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.photo_url} alt="" className={`${size} rounded-full bg-gray-100 object-cover`} />
  ) : (
    <span className={`${size} flex items-center justify-center rounded-full bg-gray-100 text-lg`}>
      {POS_EMOJI[p.position ?? ""] ?? "⚽"}
    </span>
  );
}

function fmtBirth(d?: string | null): string | null {
  if (!d || d.length < 10) return null;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function PlayerCard({ p }: { p: SquadPlayer }) {
  const birth = fmtBirth(p.birth_date);
  const showGoals = p.season_goals != null && p.position !== "GK";
  return (
    <div className="flex gap-3 border-b border-gray-100 px-3.5 py-3 last:border-0">
      <PlayerAvatar p={p} size="h-12 w-12" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <PositionBadge position={p.position} />
          <span className="truncate text-[13px] font-semibold text-gray-900">{p.name}</span>
          {p.number != null && <span className="text-[11px] text-gray-300">#{p.number}</span>}
          {p.wiki_url && (
            <a href={p.wiki_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500">
              ↗
            </a>
          )}
        </div>
        <div className="truncate text-[11px] text-gray-500">
          {POS_ES[p.position ?? ""] ?? p.position ?? "—"}
          {p.club && ` · ${p.club}`}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-400">
          {p.age != null && <span>{p.age} años</span>}
          {birth && <span>· 🎂 {birth}</span>}
          {p.season_apps != null && <span>· {p.season_apps} PJ</span>}
          {showGoals && <span>· {p.season_goals} ⚽</span>}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2.5 text-center">
      <div className="text-base font-semibold text-gray-900">{value}</div>
      <div className="mt-0.5 text-[11px] text-gray-400">{label}</div>
    </div>
  );
}

export default function SeleccionPage({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const { data: standings } = useStandings();
  const { data: matches, isLoading } = useMatches();
  const { data: squad } = useSquad(name);

  const row = standings?.find((t) => t.name === name);
  const teamMatches = useMemo(() => {
    const list = (matches ?? []).filter(
      (m: Match) => m.home_team.name === name || m.away_team.name === name,
    );
    return list.sort((a, b) => parseISO(a.kickoff_at).getTime() - parseISO(b.kickoff_at).getTime());
  }, [matches, name]);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
        <button onClick={() => history.back()} className="flex items-center gap-1 text-[13px] text-gray-500 transition-colors hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
      </header>

      <div className="border-b border-gray-100 bg-white px-5 py-6 text-center">
        <div className="text-6xl">{flagFor(name)}</div>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">{name}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {row?.group ? `Grupo ${row.group}` : "Mundial 2026"}
          {row?.points != null && ` · ${row.points} pts`}
        </p>
      </div>

      <main className="px-4 pb-24 pt-3">
        {row && (
          <>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Fase de grupos
            </p>
            <div className="mb-5 grid grid-cols-3 gap-2">
              <Stat value={row.played ?? 0} label="PJ" />
              <Stat value={row.wins ?? 0} label="Ganados" />
              <Stat value={row.draws ?? 0} label="Empates" />
              <Stat value={row.losses ?? 0} label="Perdidos" />
              <Stat value={(row.goal_difference ?? 0) > 0 ? `+${row.goal_difference}` : (row.goal_difference ?? 0)} label="Dif. gol" />
              <Stat value={row.points ?? 0} label="Puntos" />
            </div>
          </>
        )}

        {squad?.players && squad.players.length > 0 && (
          <>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Plantel ({squad.players.length})
            </p>
            <div className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {squad.players.map((p) => (
                <PlayerCard key={p.id} p={p} />
              ))}
            </div>
          </>
        )}

        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">Partidos</p>
        {isLoading && <div className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />}
        <div className="space-y-2">
          {teamMatches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
          {!isLoading && teamMatches.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">Sin partidos para {name}.</p>
          )}
        </div>
      </main>

      <Navbar />
    </>
  );
}

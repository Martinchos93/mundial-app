"use client";

import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";
import { useTeam } from "@/lib/api";
import type { Player } from "@/types";

function positionEmoji(pos: string): string {
  const p = (pos || "").toLowerCase();
  if (p.includes("arq") || p.includes("portero") || p.includes("goal") || p === "g") return "🧤";
  if (p.includes("def") || p === "d") return "🛡️";
  if (p.includes("med") || p.includes("mid") || p === "m") return "🎯";
  if (p.includes("extrem") || p.includes("wing")) return "⚡";
  return "⚽";
}

function TStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2.5 text-center">
      <div className="text-base font-semibold text-gray-900">{value}</div>
      <div className="mt-0.5 text-[11px] text-gray-400">{label}</div>
    </div>
  );
}

function PlayerRow({ player }: { player: Player }) {
  const hasGA = (player.goals ?? 0) > 0 || (player.assists ?? 0) > 0;
  return (
    <Link
      href={`/players/${player.id}`}
      className="flex items-center gap-2.5 border-b border-gray-100 px-3.5 py-2.5 transition-colors last:border-0 hover:bg-gray-50"
    >
      <span className="w-[18px] text-center text-xs text-gray-400">{player.number ?? "-"}</span>
      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gray-100 text-sm">
        {positionEmoji(player.position)}
      </span>
      <div className="flex-1">
        <div className="text-[13px] font-medium text-gray-900">{player.name}</div>
        <div className="text-[11px] text-gray-400">{player.position}</div>
      </div>
      <div className="text-right text-xs text-gray-600">
        {hasGA && `${player.goals}G ${player.assists}A · `}
        {player.rating != null ? `⭐${player.rating.toFixed(1)}` : ""}
      </div>
    </Link>
  );
}

export default function TeamProfilePage({ params }: { params: { id: string } }) {
  const { team, isLoading, error } = useTeam(params.id);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <Link href="/teams" className="flex items-center gap-1 text-[13px] text-gray-500 transition-colors hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Grupos
        </Link>
        <button className="text-gray-300 transition-colors hover:text-red-400" aria-label="Favorito">
          <Heart className="h-5 w-5" />
        </button>
      </header>

      {isLoading && <div className="m-4 h-48 animate-pulse rounded-xl border border-gray-200 bg-white" />}
      {error && (
        <p className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          No se pudo cargar la selección.
        </p>
      )}

      {team && (
        <>
          <div className="border-b border-gray-100 bg-white px-5 py-5 text-center">
            <div className="mb-2 text-5xl">{team.flag_emoji || "🏳️"}</div>
            <div className="text-xl font-semibold text-gray-900">{team.name}</div>
            <div className="mt-1 text-xs text-gray-400">
              {team.coach ? `DT: ${team.coach}` : "DT: —"} · Grupo {team.group ?? "—"}
              {team.points != null && ` · ${team.points} pts`}
            </div>
          </div>

          <main className="px-4 pb-10 pt-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Stats del torneo
            </p>
            <div className="mb-2.5 grid grid-cols-2 gap-2">
              <TStat value={team.goals_for ?? 0} label="Goles" />
              <TStat value={(team.xg_for ?? 0).toFixed(1)} label="xG prom" />
              <TStat value={`${Math.round(team.possession ?? 0)}%`} label="Posesión" />
              <TStat value={team.goals_against ?? 0} label="En contra" />
            </div>

            {team.players && team.players.length > 0 && (
              <>
                <p className="mb-2 mt-3 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Plantel destacado
                </p>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  {team.players.slice(0, 15).map((p) => (
                    <PlayerRow key={p.id} player={p} />
                  ))}
                </div>
              </>
            )}
          </main>
        </>
      )}
    </>
  );
}

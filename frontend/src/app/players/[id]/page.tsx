"use client";

import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";
import { usePlayer } from "@/lib/api";
import PositionBadge from "@/components/PositionBadge";
import type { Player } from "@/types";

function positionEmoji(pos: string): string {
  const p = (pos || "").toLowerCase();
  if (p.includes("arq") || p.includes("portero") || p.includes("goal") || p === "g") return "🧤";
  if (p.includes("def") || p === "d") return "🛡️";
  if (p.includes("med") || p.includes("mid") || p === "m") return "🎯";
  return "⚽";
}

function PStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2 text-center">
      <div className="text-lg font-semibold text-gray-900">{value}</div>
      <div className="mt-0.5 text-[11px] text-gray-400">{label}</div>
    </div>
  );
}

export default function PlayerProfilePage({ params }: { params: { id: string } }) {
  const { data: player, isLoading, error } = usePlayer(params.id);
  const p = player as Player | undefined;

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <Link
          href={p?.team_id ? `/teams/${p.team_id}` : "/teams"}
          className="flex items-center gap-1 text-[13px] text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <button className="text-gray-300 transition-colors hover:text-red-400" aria-label="Favorito">
          <Heart className="h-5 w-5" />
        </button>
      </header>

      <main className="px-4 pb-10 pt-3">
        {isLoading && <div className="h-44 animate-pulse rounded-xl border border-gray-200 bg-white" />}
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            No se pudo cargar el jugador.
          </p>
        )}

        {p && (
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-white p-3.5">
              <div className="mb-3.5 flex items-center gap-3">
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gray-100 text-2xl">
                  {positionEmoji(p.position)}
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <PositionBadge position={p.position} />
                    <span className="text-[15px] font-medium text-gray-900">{p.name}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {p.position}
                    {p.number != null && ` · #${p.number}`}
                  </div>
                  {(p.nationality || p.age != null) && (
                    <div className="text-xs text-gray-400">
                      {p.nationality}
                      {p.nationality && p.age != null && " · "}
                      {p.age != null && `${p.age} años`}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <PStat value={p.goals} label="Goles" />
                <PStat value={p.assists} label="Asistencias" />
                <PStat value={p.yellow_cards} label="Amarillas" />
                <PStat value={p.minutes_played ? `${p.minutes_played}'` : "—"} label="Minutos" />
                <PStat value={p.rating != null ? p.rating.toFixed(1) : "—"} label="Rating" />
                <PStat value={p.xg != null ? p.xg.toFixed(1) : "—"} label="xG total" />
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTournamentStats, type ScorerStat, type TeamStat } from "@/lib/api";
import { flagFor } from "@/lib/flags";
import { cn } from "@/lib/utils";

function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-center">
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  );
}

function Avatar({ s }: { s: ScorerStat }) {
  if (s.photo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={s.photo_url} alt={s.name} className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-base">
      {flagFor(s.team || "")}
    </span>
  );
}

export default function TournamentStats() {
  const { data, isLoading } = useTournamentStats();
  const router = useRouter();

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-white" />;
  }

  const totals = data?.totals;
  const scorers = data?.scorers ?? [];
  const teams = data?.teams ?? [];

  if (!totals || totals.matches === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <span className="text-4xl">📊</span>
        <p className="mt-3 text-sm text-gray-500">Todavía no hay partidos jugados.</p>
        <p className="text-[12px] text-gray-400">Las estadísticas aparecen cuando empiece el Mundial.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex gap-2">
        <StatCard value={totals.goals} label="Goles" />
        <StatCard value={totals.matches} label="Partidos" />
        <StatCard value={totals.avg_goals} label="Goles/partido" />
        <StatCard value={`${totals.yellows}/${totals.reds}`} label="🟨 / 🟥" />
      </div>

      {/* Top scorers */}
      <div>
        <h2 className="mb-2 text-[13px] font-semibold text-gray-900">⚽ Goleadores</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {scorers.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-gray-400">Sin goles todavía.</p>
          )}
          {scorers.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              onClick={() => s.team && router.push(`/seleccion/${encodeURIComponent(s.team)}`)}
              className="flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2 text-left last:border-0 hover:bg-gray-50"
            >
              <span className={cn("w-4 text-center text-[12px] font-semibold", i < 3 ? "text-amber-500" : "text-gray-400")}>
                {i + 1}
              </span>
              <Avatar s={s} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-gray-800">{s.name}</span>
                <span className="block truncate text-[11px] text-gray-400">
                  {flagFor(s.team || "")} {s.team ?? "—"}
                  {(s.yellows > 0 || s.reds > 0) && (
                    <span className="ml-1.5">
                      {s.yellows > 0 && `🟨${s.yellows} `}
                      {s.reds > 0 && `🟥${s.reds}`}
                    </span>
                  )}
                </span>
              </span>
              <span className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-gray-900">{s.goals}</span>
                <span className="text-[10px] text-gray-400">{s.goals === 1 ? "gol" : "goles"}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Team stats */}
      <div>
        <h2 className="mb-2 text-[13px] font-semibold text-gray-900">📊 Por equipo</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-[10px] uppercase text-gray-400">
                <th className="border-b border-gray-100 py-1.5 pl-2.5 text-left font-medium">Equipo</th>
                <th className="border-b border-gray-100 px-1 font-medium">PJ</th>
                <th className="border-b border-gray-100 px-1 font-medium">GF</th>
                <th className="border-b border-gray-100 px-1 font-medium">GC</th>
                <th className="border-b border-gray-100 px-1 font-medium">DIF</th>
                <th className="border-b border-gray-100 px-1 font-medium">🟨</th>
                <th className="border-b border-gray-100 px-1 font-medium">🟥</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t: TeamStat) => (
                <tr
                  key={t.team}
                  onClick={() => router.push(`/seleccion/${encodeURIComponent(t.team)}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="border-b border-gray-50 py-2 pl-2.5 text-left">
                    <span className="flex items-center gap-1.5">
                      <span>{flagFor(t.team)}</span>
                      <span className="font-medium text-gray-800">{t.team}</span>
                    </span>
                  </td>
                  <td className="border-b border-gray-50 px-1 text-center text-gray-500">{t.played}</td>
                  <td className="border-b border-gray-50 px-1 text-center font-semibold text-gray-900">{t.gf}</td>
                  <td className="border-b border-gray-50 px-1 text-center text-gray-500">{t.ga}</td>
                  <td className="border-b border-gray-50 px-1 text-center text-gray-500">
                    {t.gd > 0 ? `+${t.gd}` : t.gd}
                  </td>
                  <td className="border-b border-gray-50 px-1 text-center text-gray-500">{t.yellows}</td>
                  <td className="border-b border-gray-50 px-1 text-center text-gray-500">{t.reds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

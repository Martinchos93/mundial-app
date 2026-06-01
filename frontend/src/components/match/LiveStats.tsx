import type { Match } from "@/types";

interface StatRow {
  label: string;
  home: number;
  away: number;
  decimals?: number;
  suffix?: string;
}

function StatBar({ row }: { row: StatRow }) {
  const total = row.home + row.away;
  const homePct = total > 0 ? (row.home / total) * 100 : 50;
  const fmt = (v: number) =>
    `${row.decimals ? v.toFixed(row.decimals) : Math.round(v)}${row.suffix ?? ""}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="w-12 font-semibold text-blue-600">{fmt(row.home)}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
          {row.label}
        </span>
        <span className="w-12 text-right font-semibold text-orange-500">{fmt(row.away)}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="bg-blue-500 transition-all duration-500"
          style={{ width: `${homePct}%` }}
        />
        <div
          className="bg-orange-500 transition-all duration-500"
          style={{ width: `${100 - homePct}%` }}
        />
      </div>
    </div>
  );
}

export default function LiveStats({ match }: { match: Match }) {
  const rows: StatRow[] = [
    { label: "Posesión", home: match.home_possession ?? 0, away: match.away_possession ?? 0, suffix: "%" },
    { label: "Tiros", home: match.home_shots ?? 0, away: match.away_shots ?? 0 },
    { label: "Al arco", home: match.home_shots_on_target ?? 0, away: match.away_shots_on_target ?? 0 },
    { label: "xG", home: match.home_xg ?? 0, away: match.away_xg ?? 0, decimals: 2 },
    { label: "Pases", home: match.home_passes ?? 0, away: match.away_passes ?? 0 },
    { label: "Amarillas", home: match.home_yellows ?? 0, away: match.away_yellows ?? 0 },
  ];

  return (
    <div className="space-y-3.5 rounded-xl border border-gray-200 bg-white p-4">
      {rows.map((row) => (
        <StatBar key={row.label} row={row} />
      ))}
    </div>
  );
}

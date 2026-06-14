import type { Match, SideLineup } from "@/types";

function SideColumn({ team, flag, side }: { team: string; flag: string; side: SideLineup | null }) {
  if (!side || side.starting.length === 0) return null;
  return (
    <div className="flex-1">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-lg">{flag}</span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-gray-900">{team}</div>
          {side.formation && <div className="text-[10px] text-gray-400">{side.formation}</div>}
        </div>
      </div>

      <ul className="space-y-0.5">
        {side.starting.map((p) => (
          <li key={`${p.num}-${p.name}`} className="flex items-baseline gap-1.5 text-[12px]">
            <span className="w-5 flex-none text-right text-[10px] tabular-nums text-gray-400">{p.num ?? ""}</span>
            <span className="truncate text-gray-800">
              {p.name}
              {p.captain && <span className="ml-1 text-[9px] font-semibold text-amber-500">(C)</span>}
            </span>
          </li>
        ))}
      </ul>

      {side.subs.length > 0 && (
        <div className="mt-2.5 border-t border-gray-100 pt-2">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">Cambios</div>
          <ul className="space-y-1">
            {side.subs.map((s, i) => (
              <li key={i} className="flex items-baseline gap-1.5 text-[11px] leading-snug">
                <span className="w-5 flex-none text-right text-[10px] tabular-nums text-gray-400">
                  {s.minute != null ? `${s.minute}'` : ""}
                </span>
                <span className="min-w-0">
                  <span className="text-green-600">▲ {s.in}</span>
                  {s.out && <span className="text-gray-400"> · ▼ {s.out}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Lineups({ match }: { match: Match }) {
  const lu = match.lineups;
  if (!lu || (!lu.home && !lu.away)) return null;
  return (
    <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4">
      <SideColumn team={match.home_team?.short_name || match.home_team?.name || ""} flag={match.home_team?.flag_emoji || "🏳️"} side={lu.home} />
      <div className="w-px flex-none bg-gray-100" />
      <SideColumn team={match.away_team?.short_name || match.away_team?.name || ""} flag={match.away_team?.flag_emoji || "🏳️"} side={lu.away} />
    </div>
  );
}

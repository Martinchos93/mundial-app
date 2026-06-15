"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus, Check, ChevronDown } from "lucide-react";
import type { Match, Prediction, AIResult, PlayerEvent } from "@/types";
import { cn, isLockExpired, getToken } from "@/lib/utils";
import { playerNameMatch } from "@/lib/playerName";
import { submitPrediction, useSettings, useMe } from "@/lib/api";
import PlayerEventsTable, { type EventMap } from "@/components/prode/PlayerEventsTable";

interface Props {
  match: Match;
  existing?: Prediction;
  columnId?: number | null;
  onSaved?: () => void;
}

function shortName(m: Match, side: "home" | "away") {
  const t = side === "home" ? m.home_team : m.away_team;
  return t?.short_name || t?.name || (side === "home" ? "Local" : "Visitante");
}

function lockShort(kickoffIso: string): string {
  const mins = Math.max(0, Math.round((Date.parse(kickoffIso) - Date.now()) / 60000));
  const h = Math.floor(mins / 60);
  return h >= 1 ? `${h}h` : `${mins}m`;
}

function aiLine(match: Match): string | null {
  const ai = match.ai_prediction;
  if (!ai) return null;
  const map: Record<AIResult, { label: string; prob: number }> = {
    local: { label: shortName(match, "home"), prob: ai.prob_home },
    empate: { label: "Empate", prob: ai.prob_draw },
    visitante: { label: shortName(match, "away"), prob: ai.prob_away },
  };
  const best = map[ai.result];
  return `IA predice: ${ai.suggested_score} · ${best.label} ${Math.round((best.prob ?? 0) * 100)}%`;
}

function toEventMap(players?: PlayerEvent[]): EventMap {
  const m: EventMap = {};
  for (const p of players ?? []) m[p.name] = { ...p };
  return m;
}

function Stepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex-1 rounded-lg bg-gray-50 p-2 text-center">
      <div className="mb-1.5 text-[10px] text-gray-400">{label}</div>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="min-w-4 text-[15px] font-semibold text-gray-900">{value}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(value + 1)}
          className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 disabled:opacity-40"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, detail, pts }: { icon: string; label: string; detail: string; pts: number }) {
  const win = pts > 0;
  return (
    <div className="flex items-center gap-2.5 border-t border-gray-50 py-2 first:border-t-0">
      <span className="w-5 flex-none text-center text-[14px]">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[12.5px] font-medium text-gray-800">
          {label}
          <span className={win ? "text-green-600" : "text-gray-300"}>{win ? "✓" : "✗"}</span>
        </div>
        <div className="text-[11px] leading-snug text-gray-400">{detail}</div>
      </div>
      <span
        className={cn(
          "flex-none rounded-lg px-2 py-1 text-[12.5px] font-semibold",
          win ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400",
        )}
      >
        +{pts}
      </span>
    </div>
  );
}

export default function PredictionForm({ match, existing, columnId, onSaved }: Props) {
  const token = getToken();
  const { data: settings } = useSettings();
  const aiEnabled = settings?.ai_enabled ?? false;
  const { data: me } = useMe();
  const prodeCount = (me?.memberships ?? []).filter((m) => m.status === "active").length;

  const [home, setHome] = useState(existing?.pred_home_score ?? 0);
  const [away, setAway] = useState(existing?.pred_away_score ?? 0);
  const [yellows, setYellows] = useState(existing?.pred_yellows ?? 0);
  const [reds, setReds] = useState(existing?.pred_reds ?? 0);
  const [events, setEvents] = useState<EventMap>(toEventMap(existing?.pred_players));
  const [applyAll, setApplyAll] = useState(true);
  const [openTable, setOpenTable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const homeName = shortName(match, "home");
  const awayName = shortName(match, "away");
  const homeTeamName = match.home_team?.name || homeName;
  const awayTeamName = match.away_team?.name || awayName;

  const picks = Object.values(events).filter((e) => e.g || e.y || e.r);

  // Only nudge to join when there's genuinely no prediction to show. A match that
  // already has the user's pick (live or finished) must render it, even if the
  // columnId prop wasn't threaded through.
  if ((!token || !columnId) && !existing) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
        <p className="mb-3 text-sm text-gray-500">Unite a un grupo para hacer tu predicción.</p>
        <Link
          href="/grupos"
          className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Unite a un grupo
        </Link>
      </div>
    );
  }

  const locked = isLockExpired(match.kickoff_at) || match.status !== "scheduled";

  // Scored breakdown view
  if (existing?.is_scored) {
    const scorers = match.scorers ?? [];
    const realYellows = (match.home_yellows ?? 0) + (match.away_yellows ?? 0);
    const realReds = (match.home_reds ?? 0) + (match.away_reds ?? 0);
    const outcome = (h: number | null, a: number | null) =>
      h == null || a == null ? "—" : h > a ? `gana ${homeName}` : h < a ? `gana ${awayName}` : "empate";
    const predScorers = (existing.pred_players ?? []).filter((p) => p.g);
    const scorersHit = predScorers.filter(
      (p) => scorers.filter((n) => playerNameMatch(n, p.name)).length >= (p.g ?? 1),
    );

    const rows: { icon: string; label: string; detail: string; pts: number }[] = [
      {
        icon: "🎯",
        label: "Resultado",
        detail: `Predijiste «${outcome(existing.pred_home_score, existing.pred_away_score)}» · fue «${outcome(
          match.home_score,
          match.away_score,
        )}»`,
        pts: existing.pts_result,
      },
      {
        icon: "🔢",
        label: "Marcador exacto",
        detail: `Predijiste ${existing.pred_home_score}-${existing.pred_away_score} · fue ${match.home_score}-${match.away_score}`,
        pts: existing.pts_goals + existing.pts_exact_score,
      },
      {
        icon: "🟨",
        label: "Amarillas del partido",
        detail:
          existing.pred_yellows > 0
            ? `Predijiste ${existing.pred_yellows} · hubo ${realYellows}`
            : `No predijiste amarillas (hubo ${realYellows})`,
        pts: existing.pts_yellows_scored,
      },
      {
        icon: "🟥",
        label: "Rojas del partido",
        detail:
          existing.pred_reds > 0
            ? `Predijiste ${existing.pred_reds} · hubo ${realReds}`
            : `No predijiste rojas (hubo ${realReds})`,
        pts: existing.pts_reds_scored,
      },
    ];
    if (predScorers.length > 0) {
      rows.push({
        icon: "⚽",
        label: "Goleadores",
        detail: `Acertaste ${scorersHit.length}/${predScorers.length}: ${predScorers
          .map((p) => `${p.name}${scorersHit.includes(p) ? " ✅" : " ❌"}`)
          .join(" · ")}`,
        pts: existing.pts_scorers,
      });
    }
    if (existing.pts_cards > 0 || (existing.pred_players ?? []).some((p) => p.y || p.r)) {
      rows.push({
        icon: "🟨🟥",
        label: "Tarjetas a tus jugadores",
        detail: "Puntos por amarillas/rojas que les pegaron a los jugadores que marcaste",
        pts: existing.pts_cards,
      });
    }

    return (
      <div className="rounded-xl border border-gray-200 bg-white p-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[13px] font-medium text-gray-900">
            {match.home_team?.flag_emoji} {homeName} {match.home_score}-{match.away_score} {awayName}{" "}
            {match.away_team?.flag_emoji}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">🔒 Cerrada</span>
        </div>
        <p className="mb-2 text-[11px] text-gray-400">
          Tu predicción:{" "}
          <span className="font-medium text-gray-600">
            {existing.pred_home_score}-{existing.pred_away_score}
          </span>
        </p>

        <div className="mb-2 rounded-lg border border-gray-100 px-2.5">
          {rows.map((r) => (
            <DetailRow key={r.label} {...r} />
          ))}
        </div>

        {scorers.length > 0 && (
          <p className="mb-2 text-[11px] text-gray-500">
            ⚽ Marcaron: <span className="text-gray-700">{scorers.join(", ")}</span>
          </p>
        )}
        <div className="rounded-lg bg-green-50 py-1.5 text-center text-[13px] font-semibold text-green-600">
          Total: +{existing.total_points} pts
        </div>
      </div>
    );
  }

  function clampScore(v: string): number {
    const n = parseInt(v, 10);
    if (Number.isNaN(n) || n < 0) return 0;
    return Math.min(n, 30);
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      await submitPrediction({
        match_id: match.id,
        column_id: Number(columnId),
        pred_home_score: home,
        pred_away_score: away,
        pred_yellows: yellows,
        pred_reds: reds,
        pred_players: picks,
        apply_to_all: prodeCount > 1 && applyAll,
      });
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 403 ? "La predicción está cerrada." : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  const ai = aiLine(match);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="mb-3.5 flex items-center justify-between">
        <span className="text-[13px] font-medium text-gray-900">
          {match.home_team?.flag_emoji} {homeName} vs {awayName} {match.away_team?.flag_emoji}
        </span>
        {locked ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px]",
              match.status === "live" ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-500",
            )}
          >
            {match.status === "live" ? "⚡ En vivo" : "🔒 Cerrada"}
          </span>
        ) : (
          <span className="text-[11px] text-amber-600">🕐 {lockShort(match.kickoff_at)}</span>
        )}
      </div>

      <div className="mb-3.5 flex items-center justify-center gap-4">
        <div className="text-center">
          <div className="mb-1 text-[11px] text-gray-400">{homeName}</div>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={home}
            disabled={locked}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setHome(clampScore(e.target.value))}
            className="h-14 w-14 rounded-xl border border-gray-200 bg-gray-50 text-center text-[22px] font-semibold text-gray-900 focus:border-blue-400 focus:outline-none disabled:text-gray-400"
          />
        </div>
        <span className="pt-5 text-lg text-gray-300">-</span>
        <div className="text-center">
          <div className="mb-1 text-[11px] text-gray-400">{awayName}</div>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={away}
            disabled={locked}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setAway(clampScore(e.target.value))}
            className="h-14 w-14 rounded-xl border border-gray-200 bg-gray-50 text-center text-[22px] font-semibold text-gray-900 focus:border-blue-400 focus:outline-none disabled:text-gray-400"
          />
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <Stepper label="🟨 Amarillas" value={yellows} onChange={setYellows} disabled={locked} />
        <Stepper label="🟥 Rojas" value={reds} onChange={setReds} disabled={locked} />
        <div className="flex-1 rounded-lg bg-gray-50 p-2 text-center">
          <div className="mb-1.5 text-[10px] text-gray-400">⚽ Goles</div>
          <div className="text-lg font-semibold text-gray-700">{home + away}</div>
        </div>
      </div>

      {!locked && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setOpenTable((o) => !o)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-left"
          >
            <span className="text-[12px] font-medium text-gray-700">
              ⚽🟨🟥 Goleadores y tarjetas <span className="text-gray-400">(opcional)</span>
              {picks.length > 0 && (
                <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 text-[10px] font-semibold text-blue-700">
                  {picks.length}
                </span>
              )}
            </span>
            <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", openTable && "rotate-180")} />
          </button>
          {openTable && (
            <div className="mt-2">
              <p className="mb-1.5 text-[10px] text-gray-400">
                Goles +3 c/u · amarilla +2 · roja +4. Los goles deben coincidir con tu marcador{" "}
                <span className="font-medium">({home}-{away})</span>; amarillas/rojas hasta 3 por equipo y no más de las que predijiste arriba.
              </p>
              <PlayerEventsTable
                homeTeam={homeTeamName}
                awayTeam={awayTeamName}
                value={events}
                onChange={setEvents}
                disabled={locked}
                homeGoals={home}
                awayGoals={away}
                maxYellowsTotal={yellows}
                maxRedsTotal={reds}
              />
            </div>
          )}
        </div>
      )}

      {aiEnabled && ai && <p className="mb-2.5 text-center text-[11px] text-gray-400">{ai}</p>}
      {error && <p className="mb-2.5 text-center text-xs text-red-500">{error}</p>}

      {!locked && prodeCount > 1 && (
        <label className="mb-2.5 flex cursor-pointer items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-2">
          <input
            type="checkbox"
            checked={applyAll}
            onChange={(e) => setApplyAll(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          <span className="text-[12px] text-gray-600">
            Aplicar a mis {prodeCount} prodes
            {!applyAll && <span className="text-gray-400"> · solo este prode</span>}
          </span>
        </label>
      )}

      {!locked && (
        <button
          onClick={handleSubmit}
          disabled={saving}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60",
            saved ? "bg-green-600" : "bg-blue-600 hover:bg-blue-700",
          )}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Guardada
            </>
          ) : saving ? (
            "Guardando..."
          ) : (
            "Confirmar predicción"
          )}
        </button>
      )}
    </div>
  );
}

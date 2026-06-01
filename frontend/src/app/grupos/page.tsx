"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, LogIn, Copy, Check } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import {
  createGroup,
  joinGroup,
  useGroup,
  useGroupColumns,
  useLeaderboard,
} from "@/lib/api";
import { cn, getToken, getGroupId, getUserId } from "@/lib/utils";
import type { Column, LeaderboardEntry } from "@/types";

const MEDALS = ["🥇", "🥈", "🥉"];
const AV_COLORS = [
  "bg-blue-100 text-blue-600",
  "bg-amber-100 text-amber-600",
  "bg-green-100 text-green-600",
  "bg-pink-100 text-pink-600",
  "bg-purple-100 text-purple-600",
  "bg-orange-100 text-orange-600",
];

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

const COL_BADGE: Record<Column["status"], { label: string; cls: string }> = {
  active: { label: "Activa", cls: "bg-green-100 text-green-600" },
  draft: { label: "Próxima", cls: "bg-gray-100 text-gray-500" },
  closed: { label: "Cerrada", cls: "bg-gray-100 text-gray-500" },
};

// ---- Group hub (when in a session) ------------------------------------

function LeaderRow({ entry, rank, isMe }: { entry: LeaderboardEntry; rank: number; isMe: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border-b border-gray-100 px-3.5 py-2.5 last:border-0",
        isMe && "bg-blue-50",
      )}
    >
      {rank <= 3 ? (
        <span className="w-6 text-center text-base">{MEDALS[rank - 1]}</span>
      ) : (
        <span className="w-6 text-center text-[13px] text-gray-400">{rank}</span>
      )}
      <span
        className={cn(
          "flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13px] font-medium",
          AV_COLORS[entry.user_id % AV_COLORS.length],
        )}
      >
        {entry.avatar_emoji && entry.avatar_emoji.length <= 2 ? entry.avatar_emoji : initials(entry.name)}
      </span>
      <div className="flex-1">
        <div className="text-[13px] font-medium text-gray-900">
          {entry.name}
          {isMe && <span className="ml-1 text-xs font-normal text-blue-600">(vos)</span>}
        </div>
        <div className="text-[11px] text-gray-400">
          {entry.total_points} pts{entry.streak ? ` · racha ${entry.streak}` : ""}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[15px] font-semibold text-gray-900">{entry.total_points}</div>
        {!!entry.delta_today && entry.delta_today > 0 && (
          <div className="text-[11px] text-green-600">+{entry.delta_today} hoy</div>
        )}
      </div>
    </div>
  );
}

function GroupHub({ groupId, userId }: { groupId: string; userId: string }) {
  const { data: group } = useGroup(groupId);
  const { data: columns } = useGroupColumns(groupId);
  const { data: leaderboard } = useLeaderboard(groupId);
  const [copied, setCopied] = useState(false);

  const code = group?.invite_code ?? "";
  const activeColumn = columns?.find((c) => c.status === "active");
  const me = leaderboard?.find((e) => e.user_id === Number(userId));
  const memberCount = group?.members?.length ?? leaderboard?.length ?? 0;

  function copyCode() {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <div className="border-b border-gray-100 bg-white px-4 py-5 text-center">
        <div className="text-lg font-semibold text-gray-900">{group?.name ?? "Mi grupo"}</div>
        <div className="mt-1 text-xs text-gray-400">
          {memberCount} integrantes
          {activeColumn && ` · Columna activa: ${activeColumn.name}`}
        </div>
        <span className="mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 font-mono text-xs text-gray-500">
          {code}
        </span>
      </div>

      <main className="px-4 pb-24 pt-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">Posiciones</p>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {(leaderboard ?? []).map((entry, i) => (
            <LeaderRow key={entry.user_id} entry={entry} rank={i + 1} isMe={entry.user_id === Number(userId)} />
          ))}
          {leaderboard?.length === 0 && (
            <p className="px-3.5 py-6 text-center text-sm text-gray-400">Todavía no hay puntos cargados.</p>
          )}
        </div>

        <p className="mb-2 mt-5 text-[11px] font-medium uppercase tracking-wider text-gray-400">Columnas</p>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {(columns ?? []).map((c) => {
            const badge = COL_BADGE[c.status];
            return (
              <div
                key={c.id}
                className="flex items-center justify-between border-b border-gray-100 px-3.5 py-2.5 last:border-0"
              >
                <div>
                  <div className="text-[13px] font-medium text-gray-900">{c.name}</div>
                  <div className="text-[11px] text-gray-400">
                    R{c.pts_result} · G{c.pts_goals} · E{c.pts_exact_score}
                  </div>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px]", badge.cls)}>{badge.label}</span>
              </div>
            );
          })}
          {columns?.length === 0 && (
            <p className="px-3.5 py-6 text-center text-sm text-gray-400">Sin columnas todavía.</p>
          )}
        </div>

        {me && (
          <>
            <p className="mb-2 mt-5 text-[11px] font-medium uppercase tracking-wider text-gray-400">Mis stats</p>
            <div className="rounded-xl border border-gray-200 bg-white px-3.5 py-1">
              <div className="flex justify-between border-b border-gray-100 py-2 text-[13px]">
                <span className="text-gray-500">Puntos totales</span>
                <span className="font-medium text-gray-900">{me.total_points}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-2 text-[13px]">
                <span className="text-gray-500">Posición</span>
                <span className="font-medium text-gray-900">#{me.rank}</span>
              </div>
              <div className="flex justify-between py-2 text-[13px]">
                <span className="text-gray-500">Racha</span>
                <span className="font-medium text-gray-900">{me.streak ?? 0}</span>
              </div>
            </div>
          </>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={copyCode}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-2.5 text-[13px] text-gray-600 transition-colors hover:bg-gray-50"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar código"}
          </button>
          <button
            onClick={copyCode}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
          >
            Invitar
          </button>
        </div>
      </main>

      <Navbar />
    </>
  );
}

// ---- Create / join (when no session) ----------------------------------

type Mode = "choose" | "create" | "join";
const EMOJIS = ["⚽", "🦁", "🐉", "🦅", "🐺", "🔥", "⭐", "👑", "🚀", "🐯"];

function CreateJoin() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [groupName, setGroupName] = useState("");
  const [userName, setUserName] = useState("");
  const [code, setCode] = useState("");
  const [emoji, setEmoji] = useState("⚽");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!groupName.trim() || !userName.trim()) {
      setError("Completá el nombre del grupo y el tuyo.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createGroup(groupName.trim(), userName.trim());
      router.push("/prode");
    } catch {
      setError("No se pudo crear el grupo.");
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!code.trim() || !userName.trim()) {
      setError("Ingresá el código y tu nombre.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await joinGroup(code.trim().toUpperCase(), userName.trim(), emoji);
      router.push("/prode");
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 404 ? "Código de grupo inválido." : "No se pudo unir al grupo.");
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none";
  const btnCls =
    "flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white px-4 py-3">
        <h1 className="text-base font-semibold text-gray-900">Grupos</h1>
      </header>
      <main className="px-4 pb-24 pt-4">
        {mode === "choose" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                <Users className="h-6 w-6 text-blue-600" />
              </span>
              <h2 className="mt-3 text-base font-semibold text-gray-900">Jugá con tus amigos</h2>
              <p className="mt-1 text-sm text-gray-400">Creá un grupo nuevo o unite con un código.</p>
            </div>
            <button onClick={() => setMode("create")} className={btnCls}>
              <Plus className="h-4 w-4" /> Crear grupo
            </button>
            <button
              onClick={() => setMode("join")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
            >
              <LogIn className="h-4 w-4" /> Unirme con código
            </button>
          </div>
        )}

        {mode !== "choose" && (
          <div className="space-y-4">
            <button
              onClick={() => {
                setMode("choose");
                setError(null);
              }}
              className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              ← Volver
            </button>

            {mode === "create" ? (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-gray-900">Crear grupo</h2>
                <input className={inputCls} placeholder="Nombre del grupo" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                <input className={inputCls} placeholder="Tu nombre" value={userName} onChange={(e) => setUserName(e.target.value)} />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button onClick={handleCreate} disabled={loading} className={btnCls}>
                  {loading ? "Creando..." : "Crear grupo"}
                </button>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-gray-900">Unirme a un grupo</h2>
                <input
                  className={cn(inputCls, "font-mono uppercase tracking-widest")}
                  placeholder="CÓDIGO"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <input className={inputCls} placeholder="Tu nombre" value={userName} onChange={(e) => setUserName(e.target.value)} />
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">Tu avatar</p>
                  <div className="flex flex-wrap gap-2">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setEmoji(e)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full text-lg transition-colors",
                          emoji === e ? "bg-blue-100 ring-2 ring-blue-400" : "bg-gray-100",
                        )}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button onClick={handleJoin} disabled={loading} className={btnCls}>
                  {loading ? "Uniéndome..." : "Unirme"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      <Navbar />
    </>
  );
}

export default function GruposPage() {
  const token = getToken();
  const userId = getUserId();
  const groupId = getGroupId();

  if (token && userId && groupId) {
    return <GroupHub groupId={groupId} userId={userId} />;
  }
  return <CreateJoin />;
}

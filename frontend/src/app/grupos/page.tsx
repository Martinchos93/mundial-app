"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogIn, Copy, Check, UserCheck, X, LogOut, Crown, KeyRound } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import GroupBreakdown from "@/components/prode/GroupBreakdown";
import ChangePasswordModal from "@/components/account/ChangePasswordModal";
import {
  useMe,
  useLeaderboard,
  useMembers,
  createProde,
  joinProde,
  approveMember,
  rejectMember,
  type MembershipInfo,
} from "@/lib/api";
import {
  cn,
  getToken,
  getUser,
  getSelectedGroupId,
  setSelectedGroupId,
  clearSession,
} from "@/lib/utils";
import type { LeaderboardEntry } from "@/types";

const MEDALS = ["🥇", "🥈", "🥉"];
const AV = ["bg-blue-100 text-blue-600", "bg-amber-100 text-amber-600", "bg-green-100 text-green-600", "bg-pink-100 text-pink-600", "bg-purple-100 text-purple-600", "bg-orange-100 text-orange-600"];
const initials = (n: string) => n.trim().slice(0, 2).toUpperCase();

function LeaderRow({ e, rank, isMe, onRemove }: { e: LeaderboardEntry; rank: number; isMe: boolean; onRemove?: () => void }) {
  return (
    <div className={cn("flex items-center gap-2.5 border-b border-gray-100 px-3.5 py-2.5 last:border-0", isMe && "bg-blue-50")}>
      <span className="w-6 text-center text-base">{rank <= 3 ? MEDALS[rank - 1] : <span className="text-[13px] text-gray-400">{rank}</span>}</span>
      <span className={cn("flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13px] font-medium", AV[e.user_id % AV.length])}>
        {e.avatar_emoji && e.avatar_emoji.length <= 2 ? e.avatar_emoji : initials(e.name)}
      </span>
      <div className="flex-1">
        <div className="text-[13px] font-medium text-gray-900">{e.name}{isMe && <span className="ml-1 text-xs font-normal text-blue-600">(vos)</span>}</div>
        <div className="text-[11px] text-gray-400">{e.total_points} pts{e.streak ? ` · racha ${e.streak}` : ""}</div>
      </div>
      <div className="text-[15px] font-semibold text-gray-900">{e.total_points}</div>
      {onRemove && (
        <button onClick={onRemove} title="Eliminar del prode" className="rounded-full p-1 text-gray-300 hover:bg-red-50 hover:text-red-500">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SelectedProde({ m, userId }: { m: MembershipInfo; userId: number }) {
  const gid = m.group_id;
  const { data: leaderboard, mutate: mutateLeaderboard } = useLeaderboard(gid);
  const { data: members, mutate: mutateMembers } = useMembers(gid);
  const [copied, setCopied] = useState(false);

  const pending = (members ?? []).filter((x) => x.status === "pending");
  const creatorId = (members ?? []).find((x) => x.is_creator)?.user_id;

  async function decide(uid: number, ok: boolean) {
    if (ok) await approveMember(gid, uid);
    else await rejectMember(gid, uid);
    mutateMembers();
  }
  async function removeMember(uid: number, name: string) {
    if (!confirm(`¿Eliminar a ${name} del prode? Deja de aparecer en la tabla.`)) return;
    await rejectMember(gid, uid);
    await Promise.all([mutateMembers(), mutateLeaderboard()]);
  }
  function copyCode() {
    navigator.clipboard?.writeText(m.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mt-2">
      <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{m.group_name}</div>
          <div className="font-mono text-[11px] text-gray-400">Código: {m.invite_code}</div>
        </div>
        <button onClick={copyCode} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Invitar"}
        </button>
      </div>

      {m.is_creator && pending.length > 0 && (
        <>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-amber-600">Solicitudes pendientes ({pending.length})</p>
          <div className="mb-4 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40">
            {pending.map((x) => (
              <div key={x.user_id} className="flex items-center gap-2.5 border-b border-amber-100 px-3.5 py-2.5 last:border-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-base">{x.avatar_emoji || "⚽"}</span>
                <span className="flex-1 text-[13px] font-medium text-gray-900">{x.name}</span>
                <button onClick={() => decide(x.user_id, true)} className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700"><UserCheck className="h-4 w-4" /></button>
                <button onClick={() => decide(x.user_id, false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-gray-400">
        <span>Integrantes y puntos</span>
        <span className="font-normal lowercase tracking-normal text-gray-400">{(leaderboard ?? []).length} jugando</span>
      </p>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {(leaderboard ?? []).map((e, i) => (
          <LeaderRow
            key={e.user_id}
            e={e}
            rank={i + 1}
            isMe={e.user_id === userId}
            onRemove={m.is_creator && e.user_id !== creatorId ? () => removeMember(e.user_id, e.name) : undefined}
          />
        ))}
        {leaderboard?.length === 0 && <p className="px-3.5 py-6 text-center text-sm text-gray-400">Todavía no hay integrantes.</p>}
      </div>

      <p className="mb-2 mt-5 text-[11px] font-medium uppercase tracking-wider text-gray-400">Cuánto sumó cada uno por partido</p>
      <GroupBreakdown groupId={gid} userId={userId} />
    </div>
  );
}

export default function GruposPage() {
  const router = useRouter();
  const { data: me, mutate } = useMe();
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !getToken()) router.replace("/login");
  }, [router]);

  useEffect(() => {
    if (!me) return;
    const stored = getSelectedGroupId();
    const active = me.memberships.filter((m) => m.status === "active");
    const pick = stored && me.memberships.some((m) => String(m.group_id) === stored) ? Number(stored) : active[0]?.group_id ?? null;
    setSelected(pick);
    if (pick) setSelectedGroupId(pick);
  }, [me]);

  if (!getToken()) return null;

  const user = getUser();

  async function doCreate() {
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try {
      const g = await createProde(name.trim());
      setSelectedGroupId(g.id);
      setSelected(g.id);
      setName(""); setMode("none");
      mutate();
    } catch { setErr("No se pudo crear el prode."); }
    finally { setBusy(false); }
  }
  async function doJoin() {
    if (!code.trim()) return;
    setBusy(true); setErr(null); setOk(null);
    try {
      const r = await joinProde(code.trim());
      setCode(""); setMode("none");
      await mutate();
      setSelectedGroupId(r.group_id);
      setSelected(r.group_id);
      setOk(
        r.status === "active"
          ? "¡Te uniste al prode!"
          : "✅ Solicitud enviada. Esperá que el creador te acepte.",
      );
    } catch (e: unknown) {
      setErr((e as { response?: { status?: number } })?.response?.status === 404 ? "Código inválido." : "No se pudo unir.");
    } finally { setBusy(false); }
  }
  function logout() {
    clearSession();
    router.replace("/login");
  }

  const selectedMembership = me?.memberships.find((m) => m.group_id === selected) ?? null;

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-base">{user?.avatar_emoji || "⚽"}</span>
          <div>
            <div className="text-sm font-semibold text-gray-900">{user?.first_name} {user?.last_name}</div>
            <div className="text-[11px] text-gray-400">@{user?.username}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowChangePwd(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"><KeyRound className="h-4 w-4" /> Clave</button>
          <button onClick={logout} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"><LogOut className="h-4 w-4" /> Salir</button>
        </div>
      </header>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}

      <main className="px-4 pb-24 pt-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Mis prodes</p>
          <div className="flex gap-1.5">
            <button onClick={() => setMode(mode === "create" ? "none" : "create")} className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white"><Plus className="h-3.5 w-3.5" /> Crear</button>
            <button onClick={() => setMode(mode === "join" ? "none" : "join")} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600"><LogIn className="h-3.5 w-3.5" /> Unirme</button>
          </div>
        </div>

        {mode === "create" && (
          <div className="mb-3 flex gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
            <input className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" placeholder="Nombre del prode" value={name} onChange={(e) => setName(e.target.value)} />
            <button onClick={doCreate} disabled={busy} className="rounded-lg bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-60">Crear</button>
          </div>
        )}
        {mode === "join" && (
          <div className="mb-3 flex gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
            <input className="flex-1 rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm uppercase tracking-widest focus:border-blue-400 focus:outline-none" placeholder="CÓDIGO" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button onClick={doJoin} disabled={busy} className="rounded-lg bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-60">Unirme</button>
          </div>
        )}
        {err && <p className="mb-2 text-xs text-red-500">{err}</p>}
        {ok && <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">{ok}</p>}

        <div className="space-y-2">
          {me?.memberships.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <span className="text-3xl">🏆</span>
              <p className="mt-2 text-sm text-gray-500">Todavía no estás en ningún prode.</p>
              <div className="mt-4 flex flex-col gap-2">
                <button onClick={() => setMode("join")} className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
                  Unirme a un prode con código
                </button>
                <button onClick={() => setMode("create")} className="rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Crear un prode nuevo
                </button>
              </div>
            </div>
          )}
          {me?.memberships.map((m) => (
            <button
              key={m.group_id}
              onClick={() => { setSelected(m.group_id); setSelectedGroupId(m.group_id); }}
              className={cn("flex w-full items-center justify-between rounded-xl border bg-white px-3.5 py-3 text-left", selected === m.group_id ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-200")}
            >
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  {m.group_name}
                  {m.is_creator && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                </div>
                <div className="font-mono text-[11px] text-gray-400">{m.invite_code}</div>
              </div>
              {m.status === "pending"
                ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-600">Pendiente</span>
                : <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] text-green-600">Activo</span>}
            </button>
          ))}
        </div>

        {selectedMembership && selectedMembership.status === "active" && user && (
          <SelectedProde m={selectedMembership} userId={user.id} />
        )}
        {selectedMembership && selectedMembership.status === "pending" && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-center text-sm text-amber-700">
            Tu ingreso a <b>{selectedMembership.group_name}</b> está pendiente de aprobación del creador.
          </p>
        )}
      </main>

      <Navbar />
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Trash2, Pencil, Eye, EyeOff, Bold, Italic, Heading, List, Link2, Image as ImageIcon, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Markdown from "@/components/Markdown";
import {
  useAdminNews,
  createNews,
  updateNews,
  deleteNews,
  syncSquads,
  recalculateAll,
  backfillPicks,
  useAdmins,
  createAdmin,
  revokeAdmin,
  makeAdmin,
  resetUserPassword,
  useAdminUsers,
  useMatches,
  setMatchResult,
  resetMatchResult,
  uploadMedia,
  useSettings,
  useFutgolfStats,
  useAdminPolls,
  usePollResults,
  createPoll,
  togglePoll,
  deletePoll,
  setSetting,
  liveSyncNow,
  useContactMessages,
  toggleContactHandled,
  markAllContactRead,
  deleteContact,
  useActiveUsers,
} from "@/lib/api";
import PlayerEventsTable, { type EventMap } from "@/components/prode/PlayerEventsTable";
import { cn, formatFullDate, getToken, getUser } from "@/lib/utils";
import type { News, Match } from "@/types";

function AdminGate() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="text-5xl">🔒</span>
      <h1 className="mt-4 text-lg font-semibold text-gray-900">Acceso restringido</h1>
      <p className="mt-1 text-sm text-gray-400">Necesitás iniciar sesión como administrador.</p>
      <Link href="/login" className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
        Iniciar sesión
      </Link>
      <Navbar />
    </div>
  );
}

function AdminsManager() {
  const { data: admins, mutate } = useAdmins();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ username: "", password: "", email: "", first_name: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    if (!f.username || !f.password || !f.email) { setMsg("Completá usuario, email y contraseña."); return; }
    setBusy(true); setMsg(null);
    try {
      await createAdmin({ username: f.username.trim(), password: f.password, email: f.email.trim(), first_name: f.first_name.trim() || "Admin" });
      setF({ username: "", password: "", email: "", first_name: "" });
      setOpen(false);
      mutate();
    } catch { setMsg("No se pudo crear el admin (¿usuario/email en uso?)."); }
    finally { setBusy(false); }
  }
  async function revoke(id: number) { await revokeAdmin(id); mutate(); }

  const input = "w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[13px] focus:border-blue-400 focus:outline-none";

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-medium text-gray-900">Administradores</div>
        <button onClick={() => setOpen((o) => !o)} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white">+ Nuevo</button>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input className={input} placeholder="Usuario" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
            <input className={input} placeholder="Nombre" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
          </div>
          <input className={input} type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input className={input} type="password" placeholder="Contraseña" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          {msg && <p className="text-xs text-red-500">{msg}</p>}
          <button onClick={create} disabled={busy} className="w-full rounded-lg bg-blue-600 py-2 text-[13px] font-medium text-white disabled:opacity-60">{busy ? "Creando..." : "Crear administrador"}</button>
        </div>
      )}
      <div className="mt-3 divide-y divide-gray-100">
        {admins?.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2 text-[13px]">
            <span className="text-gray-800">{a.first_name} <span className="text-gray-400">@{a.username}</span></span>
            <button onClick={() => revoke(a.id)} className="text-[11px] text-red-500 hover:underline">Revocar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TournamentTools() {
  const [busy, setBusy] = useState<"squads" | "recalc" | "backfill" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function squads() {
    setBusy("squads");
    setMsg(null);
    try {
      const r = await syncSquads();
      const ok = Object.values(r).filter((v) => typeof v === "number").length;
      setMsg(
        `Planteles: +${ok} selecciones (tanda de a 4 por el límite de la API). Tocá de nuevo para seguir completando.`,
      );
    } catch {
      setMsg("No se pudieron sincronizar los planteles (límite de la API por minuto).");
    } finally {
      setBusy(null);
    }
  }

  async function recalcAll() {
    setBusy("recalc");
    setMsg(null);
    try {
      const r = await recalculateAll();
      setMsg(`✅ Recalculados ${r.recalculated_predictions} pronósticos en ${r.matches} partidos terminados.`);
    } catch {
      setMsg("No se pudo recalcular. Probá de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  async function backfill() {
    setBusy("backfill");
    setMsg(null);
    try {
      const r = await backfillPicks();
      setMsg(`✅ Goleador/campeón copiados a prodes vacíos: ${r.top_scorer_filled} goleadores y ${r.champion_filled} campeones (${r.users} usuarios revisados).`);
    } catch {
      setMsg("No se pudo hacer el backfill. Probá de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="text-[13px] font-medium text-gray-900">Herramientas del torneo</div>
      <p className="mt-0.5 text-[11px] text-gray-400">
        “Simular” y “Reiniciar” están deshabilitados durante el torneo real para no sobreescribir
        resultados ni borrar pronósticos.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          disabled
          title="Deshabilitado: sobreescribiría los resultados reales"
          className="flex-1 cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 py-2 text-[13px] text-gray-300"
        >
          🔒 Simular Mundial
        </button>
        <button
          disabled
          title="Deshabilitado para no borrar resultados ni pronósticos"
          className="flex-1 cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 py-2 text-[13px] text-gray-300"
        >
          🔒 Reiniciar
        </button>
      </div>
      <button
        onClick={squads}
        disabled={busy !== null}
        className="mt-2 w-full rounded-lg border border-gray-200 bg-white py-2 text-[13px] text-gray-600 hover:bg-gray-50 disabled:opacity-60"
      >
        {busy === "squads" ? "Sincronizando planteles..." : "👥 Sincronizar planteles (API)"}
      </button>
      <button
        onClick={recalcAll}
        disabled={busy !== null}
        className="mt-2 w-full rounded-lg border border-blue-200 bg-blue-50 py-2 text-[13px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
      >
        {busy === "recalc" ? "Recalculando todos los partidos..." : "🔄 Recalcular TODO (re-puntuar partidos terminados)"}
      </button>
      <button
        onClick={backfill}
        disabled={busy !== null}
        className="mt-2 w-full rounded-lg border border-violet-200 bg-violet-50 py-2 text-[13px] font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60"
      >
        {busy === "backfill" ? "Copiando goleador/campeón..." : "🎯 Copiar goleador/campeón a prodes vacíos"}
      </button>
      {msg && <p className="mt-2 text-[11px] text-gray-500">{msg}</p>}
    </div>
  );
}

function UsersTable() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<{ id: number; username: string } | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetErr, setResetErr] = useState<string | null>(null);
  const { data, isLoading, mutate } = useAdminUsers(q, page, 10);

  useEffect(() => {
    setPage(1);
  }, [q]);

  function openReset(id: number, username: string) {
    setResetTarget({ id, username });
    setResetPw("");
    setResetErr(null);
  }

  async function submitReset() {
    if (!resetTarget) return;
    if (resetPw.trim().length < 6) {
      setResetErr("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setBusy(resetTarget.id);
    setResetErr(null);
    try {
      await resetUserPassword(resetTarget.id, resetPw.trim());
      setMsg(`✅ Contraseña de @${resetTarget.username} actualizada.`);
      setResetTarget(null);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setResetErr(
        status === 404 || status === 405
          ? "El servidor todavía no tiene esta función (esperá unos minutos al redeploy)."
          : status === 401 || status === 403
            ? "Tu sesión no tiene permisos de admin. Cerrá sesión y volvé a entrar."
            : "No se pudo actualizar la contraseña.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function toggleAdmin(id: number, isAdmin: boolean) {
    setBusy(id);
    try {
      await (isAdmin ? revokeAdmin(id) : makeAdmin(id));
      await mutate();
    } finally {
      setBusy(null);
    }
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="text-[13px] font-medium text-gray-900">Cuentas</div>
        <span className="text-[11px] text-gray-400">{total} en total</span>
      </div>
      {msg && <p className="mb-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-600">{msg}</p>}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por usuario, nombre o email…"
          className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-[13px] focus:border-blue-400 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        {data?.items.map((u) => (
          <div key={u.id} className="rounded-xl border border-gray-100 p-2.5">
            <div className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-100 text-[12px] font-semibold text-gray-500">
                {`${u.first_name?.[0] ?? ""}${u.last_name?.[0] ?? ""}`.toUpperCase() || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-gray-900">
                    {u.first_name} {u.last_name}
                  </span>
                  {u.is_admin && (
                    <span className="flex-none rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                      Admin
                    </span>
                  )}
                </div>
                <div className="truncate text-[11px] text-gray-400">
                  @{u.username}
                  {u.age != null ? ` · ${u.age} años` : ""}
                </div>
                <div className="truncate text-[11px] text-gray-400">{u.email}</div>
                <div className="text-[11px] text-gray-400">🏆 {u.prodes} {u.prodes === 1 ? "prode" : "prodes"}</div>
              </div>
            </div>
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() => toggleAdmin(u.id, u.is_admin)}
                disabled={busy === u.id}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                  u.is_admin
                    ? "border border-gray-200 text-gray-500 hover:bg-gray-50"
                    : "bg-blue-600 text-white hover:bg-blue-700",
                )}
              >
                {busy === u.id ? "…" : u.is_admin ? "Quitar admin" : "Hacer admin"}
              </button>
              <button
                onClick={() => openReset(u.id, u.username)}
                disabled={busy === u.id}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                🔑 Resetear clave
              </button>
            </div>
          </div>
        ))}
        {!isLoading && data?.items.length === 0 && (
          <p className="py-6 text-center text-[13px] text-gray-400">Sin resultados.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-[12px] text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}

      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setResetTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[14px] font-semibold text-gray-900">
              Resetear clave de @{resetTarget.username}
            </h3>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Escribí la nueva contraseña (mínimo 6 caracteres).
            </p>
            <input
              autoFocus
              type="text"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitReset()}
              placeholder="Nueva contraseña"
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-blue-400 focus:outline-none"
            />
            {resetErr && <p className="mt-2 text-[11px] text-red-500">{resetErr}</p>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setResetTarget(null)}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-[12px] font-medium text-gray-500 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitReset}
                disabled={busy === resetTarget.id}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy === resetTarget.id ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveUsersCard() {
  const { data } = useActiveUsers();
  const stat = (v: number | undefined, label: string, accent?: boolean) => (
    <div className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-center">
      <div className={cn("text-lg font-bold", accent ? "text-green-600" : "text-gray-900")}>{v ?? "—"}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  );
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-gray-900">
        <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Conectados
      </div>
      <div className="flex gap-2">
        {stat(data?.now, "ahora (5 min)", true)}
        {stat(data?.last_60m, "última hora")}
        {stat(data?.today, "hoy")}
        {stat(data?.total, "registrados")}
      </div>
    </div>
  );
}

function ContactManager() {
  const { data, mutate } = useContactMessages();
  const messages = data ?? [];
  const pending = messages.filter((m) => !m.handled).length;
  const autoRead = useRef(false);

  // Mark everything as read once the inbox is opened/loaded.
  useEffect(() => {
    if (autoRead.current) return;
    if (data && data.some((m) => !m.handled)) {
      autoRead.current = true;
      markAllContactRead().then(() => mutate());
    }
  }, [data, mutate]);

  async function toggle(id: number) {
    await toggleContactHandled(id);
    mutate();
  }

  async function markAll() {
    await markAllContactRead();
    mutate();
  }
  async function remove(id: number) {
    if (!window.confirm("¿Borrar este mensaje?")) return;
    await deleteContact(id);
    mutate();
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="text-[13px] font-medium text-gray-900">✉️ Mensajes de contacto</div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">
            {messages.length} en total{pending > 0 ? ` · ${pending} sin leer` : ""}
          </span>
          {pending > 0 && (
            <button onClick={markAll} className="rounded-lg border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50">
              Marcar todas leídas
            </button>
          )}
        </div>
      </div>
      {messages.length === 0 && <p className="py-4 text-center text-[12px] text-gray-400">Todavía no hay mensajes.</p>}
      <div className="space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-lg border p-3",
              m.handled ? "border-gray-100 bg-gray-50/60" : "border-blue-100 bg-blue-50/40",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-gray-900">{m.name}</div>
                <a href={`mailto:${m.email}`} className="text-[11px] text-blue-600 hover:underline">
                  {m.email}
                </a>
              </div>
              <span className="flex-none text-[10px] text-gray-400">{formatFullDate(m.created_at)}</span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] text-gray-700">{m.message}</p>
            <div className="mt-2 flex items-center gap-2">
              <a
                href={`mailto:${m.email}?subject=Re: tu mensaje en ProdeGoat`}
                className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
              >
                Responder
              </a>
              <button onClick={() => toggle(m.id)} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-50">
                {m.handled ? "Marcar sin leer" : "Marcar leído"}
              </button>
              <button onClick={() => remove(m.id)} className="ml-auto text-[11px] text-gray-400 hover:text-red-500">
                Borrar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={cn(
        "relative h-6 w-11 flex-none rounded-full transition-colors disabled:opacity-50",
        on ? "bg-blue-600" : "bg-gray-300",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function PollResultsInline({ pollId }: { pollId: number }) {
  const { data } = usePollResults(pollId);
  if (!data) return <p className="px-1 py-2 text-[11px] text-gray-400">Cargando…</p>;
  if (data.kind === "options") {
    const total = data.total || 0;
    return (
      <div className="space-y-1 px-1 py-2">
        {data.options.map((o, i) => {
          const c = data.tallies?.[i] ?? 0;
          const pct = total > 0 ? Math.round((c / total) * 100) : 0;
          return (
            <div key={i} className="relative overflow-hidden rounded-md border border-gray-100 bg-white">
              <div className="absolute inset-y-0 left-0 bg-blue-100" style={{ width: `${pct}%` }} />
              <div className="relative flex justify-between px-2 py-1 text-[11.5px]"><span>{o}</span><span className="text-gray-500">{c} · {pct}%</span></div>
            </div>
          );
        })}
        <p className="text-[10px] text-gray-400">{total} votos</p>
      </div>
    );
  }
  return (
    <div className="max-h-48 space-y-1 overflow-y-auto px-1 py-2">
      {(data.texts ?? []).map((t, i) => (
        <div key={i} className="rounded-md bg-gray-50 px-2 py-1 text-[11.5px]">
          <span className="text-gray-400">{t.name}:</span> <span className="text-gray-700">{t.text}</span>
        </div>
      ))}
      {(data.texts ?? []).length === 0 && <p className="text-[11px] text-gray-400">Sin respuestas todavía.</p>}
    </div>
  );
}

function PollManager() {
  const { data: polls, mutate } = useAdminPolls();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"options" | "text" | "message">("options");
  const [opts, setOpts] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [openResults, setOpenResults] = useState<number | null>(null);

  async function create() {
    if (!q.trim()) return;
    setBusy(true);
    try {
      await createPoll(q.trim(), kind, kind === "options" ? opts : []);
      setQ(""); setOpts(["", ""]); await mutate();
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="mb-2.5 text-[13px] font-medium text-gray-900">📣 Encuestas</div>

      {/* Crear */}
      <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={kind === "message" ? 3 : 1}
        placeholder={kind === "message" ? "Escribí el aviso/mensaje (ej: ¡Gracias por participar!)" : "Pregunta de la encuesta"}
        className="mb-2 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none" />
      <div className="mb-2 flex gap-1.5">
        {(["options", "text", "message"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={cn("flex-1 rounded-lg border py-1.5 text-[11px] font-medium", kind === k ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600")}>
            {k === "options" ? "Opciones" : k === "text" ? "Texto libre" : "Aviso"}
          </button>
        ))}
      </div>
      {kind === "options" && (
        <div className="mb-2 space-y-1.5">
          {opts.map((o, i) => (
            <input key={i} value={o} onChange={(e) => setOpts((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Opción ${i + 1}`}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-[12.5px] focus:border-blue-400 focus:outline-none" />
          ))}
          <button onClick={() => setOpts((p) => [...p, ""])} className="text-[11px] text-blue-600">+ agregar opción</button>
        </div>
      )}
      <button onClick={create} disabled={busy} className="mb-3 w-full rounded-lg bg-blue-600 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {busy ? "Creando…" : "Crear y publicar (queda activa)"}
      </button>

      {/* Lista */}
      <div className="space-y-2">
        {(polls ?? []).map((p) => (
          <div key={p.id} className="rounded-lg border border-gray-100 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-medium text-gray-800">{p.question}</div>
                <div className="text-[10.5px] text-gray-400">
                  {p.kind === "options" ? "Opciones" : p.kind === "text" ? "Texto" : "Aviso"}
                  {p.kind !== "message" && ` · ${p.responses} respuestas`}
                  {p.is_active && <span className="text-green-600"> · activa</span>}
                </div>
              </div>
              <div className="flex flex-none items-center gap-1.5">
                <button onClick={async () => { await togglePoll(p.id, !p.is_active); await mutate(); }}
                  className={cn("rounded-md px-2 py-1 text-[10.5px] font-medium", p.is_active ? "bg-gray-100 text-gray-600" : "bg-green-50 text-green-600")}>
                  {p.is_active ? "Pausar" : "Activar"}
                </button>
                {p.kind !== "message" && (
                  <button onClick={() => setOpenResults(openResults === p.id ? null : p.id)} className="rounded-md bg-blue-50 px-2 py-1 text-[10.5px] font-medium text-blue-600">
                    {openResults === p.id ? "Ocultar" : "Resultados"}
                  </button>
                )}
                <button onClick={async () => { if (confirm("¿Borrar encuesta?")) { await deletePoll(p.id); await mutate(); } }} className="rounded-md px-1.5 py-1 text-[12px] text-gray-300 hover:text-red-500">✕</button>
              </div>
            </div>
            {openResults === p.id && <PollResultsInline pollId={p.id} />}
          </div>
        ))}
        {(polls ?? []).length === 0 && <p className="py-2 text-center text-[11px] text-gray-400">No hay encuestas todavía.</p>}
      </div>
    </div>
  );
}

function FutgolfManager() {
  const { data, mutate } = useSettings();
  const { data: stats } = useFutgolfStats();
  const enabled = data?.futgolf_enabled ?? false;
  const forAll = data?.futgolf_all ?? false;
  const allowed = data?.futgolf_allowed ?? [];
  const [q, setQ] = useState("");
  const { data: users } = useAdminUsers(q, 1, 8);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(key: "futgolf_enabled" | "futgolf_all", value: boolean) {
    setBusy(key);
    try { await setSetting(key, value); await mutate(); } finally { setBusy(null); }
  }
  async function toggleUser(id: number) {
    const next = allowed.includes(id) ? allowed.filter((x) => x !== id) : [...allowed, id];
    await setSetting("futgolf_allowed", next); await mutate();
  }

  const acceptance = stats && stats.openers > 0 ? Math.round((stats.players / stats.openers) * 100) : 0;
  const sinkRate = stats && stats.rounds_played > 0 ? Math.round((stats.sunk / stats.rounds_played) * 100) : 0;
  const stat = (v: number | string, label: string) => (
    <div className="rounded-lg bg-gray-50 px-2 py-2 text-center">
      <div className="text-[15px] font-bold text-gray-900">{v}</div>
      <div className="text-[9.5px] leading-tight text-gray-400">{label}</div>
    </div>
  );

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="mb-2.5 text-[13px] font-medium text-gray-900">⛳ FutGolf (juego)</div>
      <div className="flex items-center justify-between border-b border-gray-50 pb-3">
        <div className="pr-3">
          <div className="text-[13px] text-gray-800">Habilitar sección</div>
          <p className="text-[11px] text-gray-400">Muestra la pestaña ⛳ FutGolf a quienes estén habilitados.</p>
        </div>
        <Toggle on={enabled} onClick={() => toggle("futgolf_enabled", !enabled)} disabled={busy !== null} />
      </div>

      <div className="flex items-center justify-between border-b border-gray-50 py-3">
        <div className="pr-3">
          <div className="text-[13px] text-gray-800">Habilitar para TODOS</div>
          <p className="text-[11px] text-gray-400">Abre la sección a todos los usuarios (ignora la lista de abajo).</p>
        </div>
        <Toggle on={forAll} onClick={() => toggle("futgolf_all", !forAll)} disabled={busy !== null} />
      </div>

      {/* Estadísticas de adopción */}
      <div className="border-b border-gray-50 py-3">
        <p className="mb-1.5 text-[11px] text-gray-400">📊 Adopción</p>
        <div className="grid grid-cols-4 gap-1.5">
          {stat(stats?.openers ?? "—", "abrieron")}
          {stat(stats?.players ?? "—", "jugaron")}
          {stat(`${acceptance}%`, "aceptación")}
          {stat(stats?.tables ?? "—", "mesas")}
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          {stat(stats?.total_opens ?? "—", "aperturas")}
          {stat(stats?.creators ?? "—", "crearon")}
          {stat(stats?.rounds_played ?? "—", "rondas")}
          {stat(`${sinkRate}%`, "embocan")}
        </div>
        <p className="mt-1.5 text-[10px] text-gray-400">«Aceptación» = de los que abrieron, cuántos jugaron al menos una ronda.</p>
      </div>

      {forAll && <p className="mb-1 mt-3 text-[11px] text-amber-600">Está abierto a TODOS — la lista de abajo se ignora.</p>}
      <p className="mb-1.5 mt-3 text-[11px] text-gray-400">Integrantes habilitados ({allowed.length}). Buscá y tocá para habilitar/quitar:</p>
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuario…"
          className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-[13px] focus:border-blue-400 focus:outline-none" />
      </div>
      <div className="space-y-1">
        {users?.items.map((u) => {
          const on = allowed.includes(u.id);
          return (
            <button key={u.id} onClick={() => toggleUser(u.id)}
              className={cn("flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-[12.5px]",
                on ? "border-green-300 bg-green-50" : "border-gray-200")}>
              <span className="truncate text-gray-700">{u.first_name} {u.last_name} <span className="text-gray-400">@{u.username}</span></span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", on ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400")}>
                {on ? "✓ habilitado" : "habilitar"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SettingsManager() {
  const { data, mutate } = useSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const aiEnabled = data?.ai_enabled ?? false;
  const liveEnabled = data?.live_scraping_enabled ?? false;

  async function toggle(key: string, value: boolean) {
    setBusy(key);
    try {
      await setSetting(key, value);
      await mutate();
    } finally {
      setBusy(null);
    }
  }

  async function syncNow() {
    setBusy("sync");
    setSyncMsg(null);
    try {
      const r = await liveSyncNow();
      setSyncMsg(
        r.enabled
          ? `✅ Sincronizado · ${r.updated ?? 0} partidos actualizados (${r.games ?? 0} en promiedos)`
          : "Está apagado: prendé el scraping primero.",
      );
    } catch {
      setSyncMsg("No se pudo sincronizar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="mb-2.5 text-[13px] font-medium text-gray-900">⚙️ Ajustes</div>

      <div className="flex items-center justify-between border-b border-gray-50 pb-3">
        <div className="pr-3">
          <div className="text-[13px] text-gray-800">Predicción por IA</div>
          <p className="text-[11px] text-gray-400">
            Muestra/oculta “Generar con IA” y los análisis de Claude en toda la app.
          </p>
        </div>
        <Toggle on={aiEnabled} disabled={busy !== null} onClick={() => toggle("ai_enabled", !aiEnabled)} />
      </div>

      <div className="flex items-center justify-between pt-3">
        <div className="pr-3">
          <div className="text-[13px] text-gray-800">Resultados en vivo (promiedos)</div>
          <p className="text-[11px] text-gray-400">
            Actualiza marcador, minuto y estado automáticamente desde promiedos durante los partidos.
            Igual podés cargar/editar resultados a mano.
          </p>
        </div>
        <Toggle on={liveEnabled} disabled={busy !== null} onClick={() => toggle("live_scraping_enabled", !liveEnabled)} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] text-gray-400">
          {liveEnabled ? "🟢 Encendido" : "⚫ Apagado"}
        </span>
        {liveEnabled && (
          <button
            onClick={syncNow}
            disabled={busy !== null}
            className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "sync" ? "Sincronizando…" : "Sincronizar ahora"}
          </button>
        )}
        {syncMsg && <span className="text-[11px] text-gray-500">{syncMsg}</span>}
      </div>
    </div>
  );
}

function matchToEvents(m: Match): EventMap {
  const ev: EventMap = {};
  const get = (n: string) => ev[n] ?? { name: n, team: null, g: 0, y: 0, r: 0 };
  for (const n of m.scorers ?? []) ev[n] = { ...get(n), g: get(n).g + 1 };
  const reds = new Set(m.red_players ?? []);
  for (const n of m.booked ?? []) ev[n] = { ...get(n), [reds.has(n) ? "r" : "y"]: 1 };
  return ev;
}

function ResultsManager() {
  const { data: matches, mutate } = useMatches();
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<number | null>(null);
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [events, setEvents] = useState<EventMap>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sel = matches?.find((m) => m.id === selId) ?? null;

  function select(m: Match) {
    setSelId(m.id);
    setHome(m.home_score ?? 0);
    setAway(m.away_score ?? 0);
    setEvents(matchToEvents(m));
    setMsg(null);
  }

  async function save() {
    if (!sel) return;
    setBusy(true);
    setMsg(null);
    try {
      const players = Object.values(events).filter((e) => e.g || e.y || e.r);
      const res = await setMatchResult(sel.id, { home_score: home, away_score: away, players, finished: true });
      setMsg(`✅ ${res.score} guardado · ${res.recalculated_predictions} predicciones recalculadas`);
      await mutate();
    } catch {
      setMsg("No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!sel) return;
    if (!window.confirm("¿Borrar el resultado de este partido? Vuelve a 'sin jugar' y se quitan los puntos que sumó.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await resetMatchResult(sel.id);
      setMsg(`↩️ Resultado borrado · ${res.cleared_predictions} predicciones reabiertas`);
      setHome(0);
      setAway(0);
      setEvents({});
      await mutate();
    } catch {
      setMsg("No se pudo borrar.");
    } finally {
      setBusy(false);
    }
  }

  const filtered = (matches ?? [])
    .filter((m) => {
      if (!q.trim()) return true;
      const t = `${m.home_team?.name ?? ""} ${m.away_team?.name ?? ""}`.toLowerCase();
      return t.includes(q.toLowerCase());
    })
    .slice(0, 40);

  const nm = (m: Match, side: "home" | "away") =>
    (side === "home" ? m.home_team : m.away_team)?.short_name ||
    (side === "home" ? m.home_team : m.away_team)?.name ||
    side;

  return (
    <div className="mb-2.5 rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="mb-1 text-[13px] font-medium text-gray-900">📝 Cargar / editar resultados</div>
      <p className="mb-2.5 text-[11px] text-gray-400">
        Cargá el marcador y (opcional) goleadores y tarjetas por jugador. Al guardar se recalculan los puntos de todos los prodes.
      </p>

      {!sel ? (
        <>
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2">
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar partido por selección…"
              className="w-full bg-transparent py-2 text-[13px] focus:outline-none"
            />
          </div>
          <div className="max-h-64 divide-y divide-gray-50 overflow-y-auto rounded-lg border border-gray-100">
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => select(m)}
                className="flex w-full items-center justify-between px-2.5 py-2 text-left hover:bg-gray-50"
              >
                <span className="text-[12px] text-gray-800">
                  {nm(m, "home")} <span className="text-gray-400">vs</span> {nm(m, "away")}
                </span>
                <span className="text-[10px] text-gray-400">
                  {m.status === "finished" ? `${m.home_score}-${m.away_score} ✓` : m.phase}
                </span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-2.5 py-3 text-[12px] text-gray-400">Sin partidos.</p>}
          </div>
        </>
      ) : (
        <>
          <button onClick={() => setSelId(null)} className="mb-2 text-[12px] text-blue-600">
            ← Elegir otro partido
          </button>
          <div className="mb-3 flex items-center justify-center gap-3">
            <div className="text-center">
              <div className="mb-1 text-[11px] text-gray-400">{nm(sel, "home")}</div>
              <input
                type="number"
                min={0}
                value={home}
                onChange={(e) => setHome(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="h-12 w-12 rounded-xl border border-gray-200 bg-gray-50 text-center text-xl font-semibold focus:border-blue-400 focus:outline-none"
              />
            </div>
            <span className="pt-5 text-gray-300">-</span>
            <div className="text-center">
              <div className="mb-1 text-[11px] text-gray-400">{nm(sel, "away")}</div>
              <input
                type="number"
                min={0}
                value={away}
                onChange={(e) => setAway(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="h-12 w-12 rounded-xl border border-gray-200 bg-gray-50 text-center text-xl font-semibold focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>

          <p className="mb-1.5 text-[10px] text-gray-400">Goleadores y tarjetas (opcional, para puntuar picks por jugador):</p>
          <PlayerEventsTable
            homeTeam={sel.home_team?.name || nm(sel, "home")}
            awayTeam={sel.away_team?.name || nm(sel, "away")}
            value={events}
            onChange={setEvents}
          />

          {msg && <p className="mt-2 text-center text-[12px] text-gray-600">{msg}</p>}
          <button
            onClick={save}
            disabled={busy}
            className="mt-2.5 w-full rounded-[10px] bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Guardando…" : sel.status === "finished" ? "Actualizar resultado" : "Guardar y contabilizar puntos"}
          </button>
          {sel.status === "finished" && (
            <button
              onClick={undo}
              disabled={busy}
              className="mt-2 w-full rounded-[10px] border border-red-200 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              ↩️ Borrar resultado (volver a “sin jugar”)
            </button>
          )}
        </>
      )}
    </div>
  );
}

const emptyForm = { title: "", body: "", image_url: "", author: "" };

export default function AdminPage() {
  const { data: news, isLoading, mutate } = useAdminNews();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<News | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState<"cover" | "body" | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File | undefined, target: "cover" | "body") {
    if (!file) return;
    setUploading(target);
    setError(null);
    try {
      const url = await uploadMedia(file);
      if (target === "cover") {
        setForm((f) => ({ ...f, image_url: url }));
      } else {
        setForm((f) => ({ ...f, body: `${f.body}\n\n![imagen](${url})\n` }));
      }
    } catch {
      setError("No se pudo subir la imagen (máx 8 MB, formato JPG/PNG/WEBP/GIF).");
    } finally {
      setUploading(null);
    }
  }

  function wrap(before: string, after = before, placeholder = "texto") {
    const ta = bodyRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const val = form.body;
    const sel = val.slice(s, e) || placeholder;
    const next = val.slice(0, s) + before + sel + after + val.slice(e);
    setForm((f) => ({ ...f, body: next }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + before.length;
      ta.selectionEnd = s + before.length + sel.length;
    });
  }

  const TOOLBAR = [
    { icon: Bold, fn: () => wrap("**"), label: "Negrita" },
    { icon: Italic, fn: () => wrap("*"), label: "Cursiva" },
    { icon: Heading, fn: () => wrap("## ", "", "Título"), label: "Título" },
    { icon: List, fn: () => wrap("- ", "", "ítem"), label: "Lista" },
    { icon: Link2, fn: () => wrap("[", "](https://)", "texto"), label: "Link" },
    { icon: ImageIcon, fn: () => bodyInputRef.current?.click(), label: "Subir imagen al cuerpo" },
  ];

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function openEdit(n: News) {
    setEditing(n);
    setForm({ title: n.title, body: n.body, image_url: n.image_url ?? "", author: n.author ?? "" });
    setError(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.body.trim()) {
      setError("Título y cuerpo son obligatorios.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      image_url: form.image_url.trim() || null,
      author: form.author.trim() || null,
    };
    try {
      if (editing) await updateNews(editing.id, payload);
      else await createNews(payload);
      setShowForm(false);
      setForm(emptyForm);
      setEditing(null);
      mutate();
    } catch {
      setError("No se pudo guardar la noticia.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(n: News) {
    await updateNews(n.id, { published: !n.published });
    mutate();
  }

  async function remove(n: News) {
    await deleteNews(n.id);
    mutate();
  }

  if (typeof window !== "undefined" && (!getToken() || !getUser()?.is_admin)) return <AdminGate />;

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Back office</h1>
          <p className="text-[11px] text-gray-400">Admin · {getUser()?.username}</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          + Noticia
        </button>
      </header>

      <main className="px-4 pb-24 pt-3">
        <ActiveUsersCard />
        <ContactManager />
        <SettingsManager />
        <PollManager />
        <FutgolfManager />
        <ResultsManager />
        <UsersTable />
        <AdminsManager />
        <TournamentTools />

        {showForm && (
          <div className="mb-2.5 rounded-xl border-2 border-blue-100 bg-white p-3.5">
            <div className="mb-3 text-[13px] font-medium text-gray-900">
              {editing ? "Editar noticia" : "Nueva noticia"}
            </div>
            <input
              className="mb-2.5 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
              placeholder="Título"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            {/* Markdown toolbar */}
            <div className="mb-1.5 flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
              {TOOLBAR.map(({ icon: Icon, fn, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={fn}
                  title={label}
                  className="rounded-md p-1.5 text-gray-600 hover:bg-white"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPreview((p) => !p)}
                className={cn(
                  "ml-auto rounded-md px-2 py-1 text-[11px] font-medium",
                  preview ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-white",
                )}
              >
                {preview ? "Editar" : "Vista previa"}
              </button>
            </div>
            {preview ? (
              <div className="mb-2.5 min-h-24 rounded-lg border border-gray-200 p-3">
                <Markdown>{form.body || "_Nada para previsualizar_"}</Markdown>
              </div>
            ) : (
              <textarea
                ref={bodyRef}
                className="mb-2.5 h-40 w-full resize-y rounded-lg border border-gray-200 px-2.5 py-2 font-mono text-[13px] focus:border-blue-400 focus:outline-none"
                placeholder="Cuerpo (markdown: **negrita**, ## título, - listas, ![img](url))"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            )}
            {/* Cover image: upload to Postgres or paste a URL */}
            <div className="mb-2.5 rounded-lg border border-gray-200 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-medium text-gray-700">Imagen de portada</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploading === "cover"}
                    className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    {uploading === "cover" ? "Subiendo…" : "Subir"}
                  </button>
                  {form.image_url && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                      className="text-[12px] text-gray-400 hover:text-red-500"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
              {form.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image_url} alt="" className="h-32 w-full rounded-lg object-cover" />
              ) : (
                <p className="text-[11px] text-gray-400">Subí un archivo (máx 8 MB) o pegá una URL abajo.</p>
              )}
              <input
                className="mt-2 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[12px] focus:border-blue-400 focus:outline-none"
                placeholder="…o pegá una URL de imagen"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </div>

            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleUpload(e.target.files?.[0], "cover");
                e.target.value = "";
              }}
            />
            <input
              ref={bodyInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleUpload(e.target.files?.[0], "body");
                e.target.value = "";
              }}
            />
            <input
              className="mb-3 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
              placeholder="Autor (opcional)"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
            />
            {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-[13px] text-gray-500 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : editing ? "Guardar" : "Crear"}
              </button>
            </div>
          </div>
        )}

        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">Noticias</p>

        {isLoading && <div className="h-20 animate-pulse rounded-xl border border-gray-200 bg-white" />}

        <div className="space-y-2.5">
          {news?.map((n) => (
            <div key={n.id} className="rounded-xl border border-gray-200 bg-white p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-gray-900">{n.title}</span>
                    {!n.published && (
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                        oculta
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{n.body}</p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {n.author ? `${n.author} · ` : ""}
                    {formatFullDate(n.created_at)}
                  </p>
                </div>
                <div className="flex flex-none gap-1">
                  <button onClick={() => togglePublish(n)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50" aria-label="Publicar/ocultar">
                    {n.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(n)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50" aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(n)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500" aria-label="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!isLoading && news?.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No hay noticias todavía.</p>
        )}
      </main>

      <Navbar />
    </>
  );
}

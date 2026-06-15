"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Plus, Trophy } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import ProdeSwitcher from "@/components/prode/ProdeSwitcher";
import {
  useSettings, useMembers,
  useFutgolfTables, useFutgolfTable,
  createFutgolfTable, startFutgolfTable, submitFutgolfResult, trackFutgolfView,
  type FutgolfTable,
} from "@/lib/api";
import { getSelectedGroupId, setSelectedGroupId, getUserId, isAdmin, cn } from "@/lib/utils";
import type { Member } from "@/types";

const FutgolfGame = dynamic(() => import("@/components/futgolf/FutgolfGame"), {
  ssr: false,
  loading: () => <div className="flex h-[70vh] items-center justify-center rounded-xl bg-[#87b9e6] text-white">Cargando cancha…</div>,
});

const ST = {
  active: { t: "Juega", c: "bg-blue-50 text-blue-600" },
  eliminated: { t: "Afuera", c: "bg-gray-100 text-gray-400" },
  winner: { t: "🏆 Ganó", c: "bg-amber-50 text-amber-600" },
} as const;

function Header() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
      <Link href="/grupos" className="flex items-center gap-1 text-[13px] text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <span className="text-base font-semibold text-gray-900">⛳ FutGolf</span>
      <span className="w-12" />
    </header>
  );
}

function CreateForm({ groupId, members, onCreated }: { groupId: number; members: Member[]; onCreated: () => void }) {
  const myId = Number(getUserId()) || 0;
  const rivals = members.filter((m) => m.status === "active" && m.user_id !== myId);
  const [name, setName] = useState("Mesa FutGolf");
  const [picked, setPicked] = useState<number[]>(rivals.map((r) => r.user_id));
  const [busy, setBusy] = useState(false);
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function create() {
    if (picked.length < 1) return;
    setBusy(true);
    try { await createFutgolfTable(groupId, name.trim() || "Mesa", picked); onCreated(); }
    finally { setBusy(false); }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="mb-2 text-[13px] font-semibold text-gray-900">Nueva mesa</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la mesa"
        className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none" />
      <p className="mb-1.5 text-[11px] text-gray-400">Elegí los rivales del prode:</p>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {rivals.map((m) => (
          <label key={m.user_id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-[12px]",
            picked.includes(m.user_id) ? "border-blue-300 bg-blue-50" : "border-gray-200")}>
            <input type="checkbox" checked={picked.includes(m.user_id)} onChange={() => toggle(m.user_id)} className="h-3.5 w-3.5 accent-blue-600" />
            <span className="truncate text-gray-700">{m.avatar_emoji} {m.name}</span>
          </label>
        ))}
        {rivals.length === 0 && <p className="col-span-2 text-[12px] text-gray-400">No hay otros integrantes en este prode.</p>}
      </div>
      <button onClick={create} disabled={busy || picked.length < 1}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        <Plus className="h-4 w-4" /> {busy ? "Creando…" : "Crear mesa"}
      </button>
    </div>
  );
}

function TableView({ tableId, onBack }: { tableId: number; onBack: () => void }) {
  const { data: t, mutate } = useFutgolfTable(tableId);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const myId = Number(getUserId()) || 0;

  if (!t) return <div className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white" />;

  const isCreator = t.created_by === myId;
  const winner = t.participants.find((p) => p.user_id === t.winner_user_id);

  async function start() { setBusy(true); try { await startFutgolfTable(tableId); await mutate(); } finally { setBusy(false); } }
  async function onResult(sunk: boolean, shots: number) {
    setBusy(true);
    try { await submitFutgolfResult(tableId, sunk, shots); await mutate(); } finally { setPlaying(false); setBusy(false); }
  }

  if (playing && t.status === "playing") {
    return (
      <div>
        <p className="mb-2 text-center text-[12px] text-gray-500">
          Ronda {t.round_no} · tenés <b>{t.shots_allowed}</b> {t.shots_allowed === 1 ? "tiro (desempate)" : "tiros"} para embocar
        </p>
        <FutgolfGame seed={t.course_seed + t.round_no * 7919} shotsAllowed={t.shots_allowed} onResult={onResult} />
        <button onClick={() => setPlaying(false)} className="mt-2 w-full rounded-lg border border-gray-200 py-2 text-[12px] text-gray-500">
          Cancelar (no cuenta hasta que termines)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-[12px] text-blue-600">‹ Todas las mesas</button>
      <div className="rounded-xl border border-gray-200 bg-white p-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-gray-900">{t.name}</h2>
          <span className="text-[11px] text-gray-400">
            {t.status === "lobby" ? "Sin empezar" : t.status === "finished" ? "Terminada" : `Ronda ${t.round_no}`}
          </span>
        </div>

        {t.status === "finished" && winner && (
          <div className="my-3 flex items-center justify-center gap-2 rounded-lg bg-amber-50 py-3 text-[15px] font-semibold text-amber-700">
            <Trophy className="h-5 w-5" /> Ganó {winner.avatar_emoji} {winner.name}
          </div>
        )}

        <div className="mt-2 divide-y divide-gray-50">
          {t.participants.map((p) => (
            <div key={p.user_id} className="flex items-center gap-2.5 py-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[12px]">{p.avatar_emoji}</span>
              <span className={cn("flex-1 truncate text-[13px]", p.status === "eliminated" ? "text-gray-400 line-through" : "text-gray-800")}>
                {p.name}{p.user_id === myId && <span className="ml-1 text-[11px] text-blue-600">(vos)</span>}
              </span>
              {t.status === "playing" && p.status === "active" && (
                <span className="text-[10px] text-gray-400">{p.submitted ? "✓ jugó" : "esperando…"}</span>
              )}
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", ST[p.status].c)}>{ST[p.status].t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Acciones */}
      {t.status === "lobby" && isCreator && (
        <button onClick={start} disabled={busy} className="w-full rounded-lg bg-green-600 py-2.5 text-[14px] font-semibold text-white hover:bg-green-700 disabled:opacity-50">
          {busy ? "…" : "▶️ Empezar mesa"}
        </button>
      )}
      {t.status === "lobby" && !isCreator && <p className="text-center text-[12px] text-gray-400">Esperando que el creador empiece la mesa…</p>}
      {t.status === "playing" && t.my_turn && (
        <button onClick={() => setPlaying(true)} className="w-full rounded-lg bg-blue-600 py-3 text-[15px] font-semibold text-white hover:bg-blue-700">
          ⛳ Jugar mi ronda ({t.shots_allowed} {t.shots_allowed === 1 ? "tiro" : "tiros"})
        </button>
      )}
      {t.status === "playing" && !t.my_turn && t.my_status === "active" && (
        <p className="text-center text-[12px] text-gray-400">Ya jugaste tu ronda. Esperando al resto…</p>
      )}
      {t.status === "playing" && t.my_status === "eliminated" && (
        <p className="text-center text-[12px] text-gray-400">Quedaste afuera 😢 Seguí mirando cómo termina.</p>
      )}
    </div>
  );
}

export default function FutgolfPage() {
  const { data: settings } = useSettings();
  const [groupId, setGroupId] = useState<number | null>(() => Number(getSelectedGroupId()) || null);
  const [sel, setSel] = useState<number | null>(null);
  const { data: members } = useMembers(groupId);
  const { data: tables, mutate } = useFutgolfTables(groupId);

  function switchProde(id: number) {
    setGroupId(id);
    setSelectedGroupId(id);
    setSel(null);
  }

  const myId = Number(getUserId()) || 0;
  const allowed = settings
    ? settings.futgolf_enabled && (settings.futgolf_all || settings.futgolf_allowed?.includes(myId) || isAdmin())
    : null;

  useEffect(() => {
    if (allowed) trackFutgolfView();
  }, [allowed]);

  return (
    <>
      <Header />
      <main className="px-4 pb-24 pt-3">
        {allowed && <ProdeSwitcher value={groupId} onChange={switchProde} className="mb-3" />}

        {allowed === false && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
            <div className="text-3xl">🔒</div>
            <p className="mt-2 text-[13px] text-gray-500">FutGolf todavía no está habilitado para tu cuenta.</p>
          </div>
        )}

        {allowed && !groupId && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-[13px] text-gray-500">Elegí un prode primero.</p>
            <Link href="/grupos" className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white">Ir a Prodes</Link>
          </div>
        )}

        {allowed && groupId && (
          sel ? (
            <TableView tableId={sel} onBack={() => { setSel(null); mutate(); }} />
          ) : (
            <>
              <CreateForm groupId={groupId} members={members ?? []} onCreated={() => mutate()} />
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">Mesas del prode</p>
              <div className="space-y-2">
                {(tables ?? []).map((t: FutgolfTable) => (
                  <button key={t.id} onClick={() => setSel(t.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-left hover:bg-gray-50">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-gray-900">{t.name}</div>
                      <div className="text-[11px] text-gray-400">
                        {t.participants.length} jugadores · {t.status === "lobby" ? "sin empezar" : t.status === "finished" ? "terminada" : `ronda ${t.round_no}`}
                      </div>
                    </div>
                    {t.status === "playing" && t.my_turn && <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white">Tu turno</span>}
                    {t.status === "finished" && <Trophy className="h-4 w-4 text-amber-500" />}
                  </button>
                ))}
                {(tables ?? []).length === 0 && <p className="py-6 text-center text-[12px] text-gray-400">No hay mesas todavía. ¡Creá una!</p>}
              </div>
            </>
          )
        )}
      </main>
      <Navbar />
    </>
  );
}

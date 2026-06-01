"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Trash2, Pencil, Eye, EyeOff, Bold, Italic, Heading, List, Link2, Image as ImageIcon } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Markdown from "@/components/Markdown";
import {
  useAdminNews,
  createNews,
  updateNews,
  deleteNews,
  simulateTournament,
  resetTournament,
  syncSquads,
  useAdmins,
  createAdmin,
  revokeAdmin,
} from "@/lib/api";
import { cn, formatFullDate, getToken, getUser } from "@/lib/utils";
import type { News } from "@/types";

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
  const [busy, setBusy] = useState<"sim" | "reset" | "squads" | null>(null);
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

  async function sim() {
    setBusy("sim");
    setMsg(null);
    try {
      const r = await simulateTournament();
      setMsg(r.champion ? `🏆 Campeón simulado: ${r.champion}. Mirá WC → Cruces.` : "Torneo simulado.");
    } catch {
      setMsg("No se pudo simular.");
    } finally {
      setBusy(null);
    }
  }
  async function reset() {
    setBusy("reset");
    setMsg(null);
    try {
      await resetTournament();
      setMsg("Fixture reiniciado a programado. Predicciones abiertas otra vez.");
    } catch {
      setMsg("No se pudo reiniciar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3.5">
      <div className="text-[13px] font-medium text-gray-900">Herramientas del torneo</div>
      <p className="mt-0.5 text-[11px] text-gray-400">
        Simulá resultados para ver las tablas y el cuadro de cruces completarse.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={sim}
          disabled={busy !== null}
          className="flex-1 rounded-lg bg-blue-600 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy === "sim" ? "Simulando..." : "⚡ Simular Mundial"}
        </button>
        <button
          onClick={reset}
          disabled={busy !== null}
          className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-[13px] text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          {busy === "reset" ? "Reiniciando..." : "↺ Reiniciar"}
        </button>
      </div>
      <button
        onClick={squads}
        disabled={busy !== null}
        className="mt-2 w-full rounded-lg border border-gray-200 bg-white py-2 text-[13px] text-gray-600 hover:bg-gray-50 disabled:opacity-60"
      >
        {busy === "squads" ? "Sincronizando planteles..." : "👥 Sincronizar planteles (API)"}
      </button>
      {msg && <p className="mt-2 text-[11px] text-gray-500">{msg}</p>}
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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

  function insertImage() {
    const url = window.prompt("URL de la imagen:");
    if (url) setForm((f) => ({ ...f, body: f.body + `\n\n![imagen](${url})\n` }));
  }

  const TOOLBAR = [
    { icon: Bold, fn: () => wrap("**"), label: "Negrita" },
    { icon: Italic, fn: () => wrap("*"), label: "Cursiva" },
    { icon: Heading, fn: () => wrap("## ", "", "Título"), label: "Título" },
    { icon: List, fn: () => wrap("- ", "", "ítem"), label: "Lista" },
    { icon: Link2, fn: () => wrap("[", "](https://)", "texto"), label: "Link" },
    { icon: ImageIcon, fn: insertImage, label: "Imagen" },
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
            <input
              className="mb-2.5 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[13px] focus:border-blue-400 focus:outline-none"
              placeholder="URL de imagen (opcional)"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
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

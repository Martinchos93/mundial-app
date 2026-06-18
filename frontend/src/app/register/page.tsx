"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register } from "@/lib/api";
import { cn } from "@/lib/utils";

const EMOJIS = ["⚽", "🦁", "🐉", "🦅", "🐺", "🔥", "⭐", "👑", "🚀", "🐯"];

export default function RegisterPage() {
  const router = useRouter();
  const [f, setF] = useState({ first_name: "", last_name: "", age: "", email: "", username: "", password: "" });
  const [emoji, setEmoji] = useState("⚽");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function handle(e?: React.FormEvent) {
    e?.preventDefault();
    if (!f.first_name || !f.last_name || !f.email || !f.username || !f.password) {
      setError("Completá todos los campos obligatorios.");
      return;
    }
    if (f.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register({
        username: f.username.trim(),
        password: f.password,
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        age: f.age ? Number(f.age) : null,
        email: f.email.trim(),
        avatar_emoji: emoji,
      });
      router.push("/grupos");
      router.refresh();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "No se pudo registrar.");
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:border-blue-400 focus:outline-none";

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-5 text-center">
          <div className="text-3xl">🏆</div>
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Crear cuenta</h1>
        </div>
        <form onSubmit={handle} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex gap-2">
            <input className={input} name="given-name" autoComplete="given-name" placeholder="Nombre" value={f.first_name} onChange={set("first_name")} />
            <input className={input} name="family-name" autoComplete="family-name" placeholder="Apellido" value={f.last_name} onChange={set("last_name")} />
          </div>
          <div className="flex gap-2">
            <input className={input} type="number" placeholder="Edad" value={f.age} onChange={set("age")} />
            <input className={input} type="email" name="email" autoComplete="email" placeholder="Email" value={f.email} onChange={set("email")} />
          </div>
          <input className={input} name="username" autoComplete="username" placeholder="Usuario" value={f.username} onChange={set("username")} />
          <input className={input} type="password" name="password" autoComplete="new-password" placeholder="Contraseña (mín. 6)" value={f.password} onChange={set("password")} />
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">Tu avatar</p>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-lg",
                    emoji === e ? "bg-blue-100 ring-2 ring-blue-400" : "bg-gray-100",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-400">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-medium text-blue-600">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

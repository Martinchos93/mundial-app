"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e?: React.FormEvent) {
    e?.preventDefault();
    if (!username.trim() || !password) {
      setError("Completá usuario (o email) y contraseña.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await login(username.trim(), password);
      router.push(user.is_admin ? "/admin" : "/grupos");
      router.refresh();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 401 ? "Usuario o contraseña inválidos." : "No se pudo iniciar sesión.");
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:border-blue-400 focus:outline-none";

  return (
    <div className="flex min-h-screen flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl">🏆</div>
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Mundial 2026</h1>
          <p className="text-sm text-gray-400">Iniciá sesión para jugar al prode</p>
        </div>
        <form onSubmit={handle} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <input
            className={input}
            name="username"
            autoComplete="username"
            placeholder="Usuario o email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className={input}
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Iniciar sesión"}
          </button>
          <p className="text-center">
            <Link href="/forgot-password" className="text-xs text-gray-400 hover:text-blue-600">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </form>
        <p className="mt-4 text-center text-sm text-gray-400">
          ¿No tenés cuenta?{" "}
          <Link href="/register" className="font-medium text-blue-600">
            Registrate
          </Link>
        </p>
      </div>
    </div>
  );
}

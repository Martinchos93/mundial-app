"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPasswordWithToken } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await resetPasswordWithToken(token, password);
      router.push(user.is_admin ? "/admin" : "/grupos");
      router.refresh();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "No se pudo cambiar la contraseña. Pedí un link nuevo.");
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:border-blue-400 focus:outline-none";

  if (!token) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
        <p className="text-sm text-gray-700">El link no es válido. Pedí uno nuevo desde la pantalla de login.</p>
        <Link href="/forgot-password" className="mt-3 inline-block text-sm font-medium text-blue-600">
          Pedir link
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
      <input
        className={input}
        type="password"
        placeholder="Nueva contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
      />
      <input
        className={input}
        type="password"
        placeholder="Repetí la contraseña"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handle()}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={handle}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl">🔒</div>
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Nueva contraseña</h1>
          <p className="text-sm text-gray-400">Elegí tu nueva contraseña</p>
        </div>
        <Suspense fallback={<p className="text-center text-sm text-gray-400">Cargando…</p>}>
          <ResetPasswordForm />
        </Suspense>
        <p className="mt-4 text-center text-sm text-gray-400">
          <Link href="/login" className="font-medium text-blue-600">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

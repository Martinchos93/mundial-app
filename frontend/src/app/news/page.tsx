"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Markdown from "@/components/Markdown";
import { useNews } from "@/lib/api";
import { formatFullDate } from "@/lib/utils";

const PAGE_SIZE = 10;

export default function NewsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useNews(page, PAGE_SIZE);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white px-4 py-3">
        <h1 className="text-base font-semibold text-gray-900">Noticias 📰</h1>
        <p className="text-[11px] text-gray-400">
          {total > 0 ? `${total} notas · página ${page} de ${totalPages}` : "Lo último del Mundial 2026"}
        </p>
      </header>

      <main className="px-4 pb-24 pt-3">
        {isLoading && (
          <div className="space-y-3">
            <div className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white" />
            <div className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white" />
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            No se pudieron cargar las noticias.
          </p>
        )}

        {!isLoading && !error && total === 0 && (
          <div className="py-16 text-center">
            <span className="text-4xl">📰</span>
            <p className="mt-3 text-sm text-gray-400">Todavía no hay noticias publicadas.</p>
          </div>
        )}

        <div className="space-y-3">
          {data?.items.map((n) => (
            <article key={n.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {n.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.image_url} alt="" className="h-44 w-full object-cover" />
              )}
              <div className="p-4">
                <h2 className="text-base font-semibold text-gray-900">{n.title}</h2>
                <p className="mt-1 text-[11px] text-gray-400">
                  {n.author ? `${n.author} · ` : ""}
                  {formatFullDate(n.created_at)}
                </p>
                <div className="mt-2">
                  <Markdown>{n.body}</Markdown>
                </div>
              </div>
            </article>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <span className="text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>

      <Navbar />
    </>
  );
}

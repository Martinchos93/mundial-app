"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useNews } from "@/lib/api";
import { formatFullDate } from "@/lib/utils";

const PAGE_SIZE = 10;

/** Strip markdown to a plain-text excerpt. */
function excerpt(body: string, max = 150): string {
  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → text
    .replace(/[#*_>`~-]/g, "") // md symbols
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

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
            <div className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />
            <div className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />
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
            <Link key={n.id} href={`/news/${n.id}`} className="block">
              <article className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300">
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-gray-900">
                    {n.title}
                  </h2>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {n.author ? `${n.author} · ` : ""}
                    {formatFullDate(n.created_at)}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-gray-500">
                    {excerpt(n.body)}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600">
                    Leer nota <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
                {n.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={n.image_url}
                    alt=""
                    className="h-[88px] w-[88px] flex-none rounded-lg object-cover"
                  />
                )}
              </article>
            </Link>
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

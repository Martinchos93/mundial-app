"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Markdown from "@/components/Markdown";
import { useNewsItem } from "@/lib/api";
import { formatFullDate } from "@/lib/utils";

export default function NewsArticlePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: n, isLoading, error } = useNewsItem(params.id);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[13px] text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
      </header>

      <main className="pb-24">
        {isLoading && (
          <div className="space-y-3 p-4">
            <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100" />
          </div>
        )}

        {error && (
          <p className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            No se pudo cargar la nota.
          </p>
        )}

        {n && (
          <article>
            {n.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={n.image_url} alt="" className="h-60 w-full object-cover sm:h-72" />
            )}
            <div className="px-4 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                Mundial 2026
              </p>
              <h1 className="mt-1.5 font-serif text-[26px] font-bold leading-tight text-gray-900">
                {n.title}
              </h1>
              <div className="mt-2.5 flex items-center gap-2 border-b border-gray-100 pb-3 text-[12px] text-gray-400">
                {n.author && <span className="font-medium text-gray-600">{n.author}</span>}
                {n.author && <span>·</span>}
                <span>{formatFullDate(n.created_at)}</span>
              </div>

              <div className="prose prose-sm mt-4 max-w-none prose-headings:font-serif prose-img:rounded-xl">
                <Markdown>{n.body}</Markdown>
              </div>
            </div>
          </article>
        )}
      </main>

      <Navbar />
    </>
  );
}

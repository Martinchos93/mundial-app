"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGlobalRanking } from "@/lib/api";
import { cn } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];
const AV = [
  "bg-blue-100 text-blue-600", "bg-amber-100 text-amber-600", "bg-green-100 text-green-600",
  "bg-pink-100 text-pink-600", "bg-purple-100 text-purple-600", "bg-orange-100 text-orange-600",
];
const initials = (n: string) => n.trim().slice(0, 2).toUpperCase();

export default function GlobalRankingCard({ userId }: { userId: number }) {
  const [page, setPage] = useState(1);
  const { data } = useGlobalRanking(page, 10);
  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  if (total === 0) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-3.5 pb-1.5 pt-3">
        <h2 className="text-[13px] font-semibold text-gray-900">🌎 Ranking global</h2>
        <span className="text-[11px] text-gray-400">{total} jugando</span>
      </div>
      <div>
        {entries.map((e) => {
          const isMe = e.user_id === userId;
          return (
            <div
              key={e.user_id}
              className={cn(
                "flex items-center gap-2.5 border-t border-gray-50 px-3.5 py-2",
                isMe && "bg-blue-50/60",
              )}
            >
              <span className="w-6 text-center text-[13px]">
                {e.rank <= 3 ? MEDALS[e.rank - 1] : <span className="text-[12px] text-gray-400">{e.rank}</span>}
              </span>
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium", AV[e.user_id % AV.length])}>
                {e.avatar_emoji && e.avatar_emoji.length <= 2 ? e.avatar_emoji : initials(e.name)}
              </span>
              <span className="flex-1 truncate text-[12.5px] font-medium text-gray-800">
                {e.name}
                {isMe && <span className="ml-1 text-[11px] font-normal text-blue-600">(vos)</span>}
              </span>
              <span className="w-9 text-right text-[14px] font-semibold text-gray-900">{e.points}</span>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-gray-100 py-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[12px] text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLeaderboard } from "@/lib/api";
import { cn } from "@/lib/utils";
import MemberMatchesModal from "@/components/prode/MemberMatchesModal";

const MEDALS = ["🥇", "🥈", "🥉"];
const AV = [
  "bg-blue-100 text-blue-600", "bg-amber-100 text-amber-600", "bg-green-100 text-green-600",
  "bg-pink-100 text-pink-600", "bg-purple-100 text-purple-600", "bg-orange-100 text-orange-600",
];
const initials = (n: string) => n.trim().slice(0, 2).toUpperCase();

export default function GroupLeaderboardCard({ groupId, userId }: { groupId: number; userId: number }) {
  const { data } = useLeaderboard(groupId);
  const [sel, setSel] = useState<{ user_id: number; name: string } | null>(null);
  const entries = data ?? [];
  if (entries.length === 0) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-3.5 pb-1.5 pt-3">
        <h2 className="text-[13px] font-semibold text-gray-900">📊 Tabla del grupo</h2>
        <span className="text-[11px] text-gray-400">{entries.length} jugando</span>
      </div>
      <div>
        {entries.map((e, i) => {
          const isMe = e.user_id === userId;
          return (
            <button
              key={e.user_id}
              onClick={() => setSel({ user_id: e.user_id, name: e.name })}
              className={cn("flex w-full items-center gap-2.5 border-t border-gray-50 px-3.5 py-2 text-left transition-colors hover:bg-gray-50", isMe && "bg-blue-50/60")}
            >
              <span className="w-5 text-center text-[13px]">
                {i < 3 ? MEDALS[i] : <span className="text-[12px] text-gray-400">{i + 1}</span>}
              </span>
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium", AV[e.user_id % AV.length])}>
                {e.avatar_emoji && e.avatar_emoji.length <= 2 ? e.avatar_emoji : initials(e.name)}
              </span>
              <span className="flex-1 truncate text-[12.5px] font-medium text-gray-800">
                {e.name}
                {isMe && <span className="ml-1 text-[11px] font-normal text-blue-600">(vos)</span>}
              </span>
              {e.delta_today ? <span className="text-[11px] text-green-600">+{e.delta_today} hoy</span> : null}
              <span className="w-9 text-right text-[14px] font-semibold text-gray-900">{e.total_points}</span>
            </button>
          );
        })}
      </div>
      <p className="border-t border-gray-50 px-3.5 py-1.5 text-center text-[10px] text-gray-400">
        Tocá un jugador para ver qué predijo en cada partido
      </p>
      <Link
        href="/grupos"
        className="flex items-center justify-center gap-1 border-t border-gray-100 py-2 text-[12px] font-medium text-blue-600 hover:bg-gray-50"
      >
        Ver cuánto sumó cada uno por partido <ArrowRight className="h-3.5 w-3.5" />
      </Link>

      {sel && <MemberMatchesModal groupId={groupId} member={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

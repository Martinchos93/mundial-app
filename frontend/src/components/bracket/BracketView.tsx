"use client";

import { useBracket, type BracketMatch } from "@/lib/api";
import { flagFor } from "@/lib/flags";
import { cn } from "@/lib/utils";

const H = 560; // bracket body height (px)

const LEFT = {
  r32: [74, 77, 73, 75, 83, 84, 81, 82],
  r16: [89, 90, 93, 94],
  qf: [97, 98],
  sf: [101],
};
const RIGHT = {
  sf: [102],
  qf: [99, 100],
  r16: [91, 92, 95, 96],
  r32: [76, 78, 79, 80, 86, 88, 85, 87],
};

const BLUE = new Set([73, 74, 75, 77, 89, 90, 97]);
const TEAL = new Set([81, 82, 83, 84, 93, 94, 98]);
const GREEN = new Set([76, 78, 79, 80, 91, 92, 99]);
const RED = new Set([85, 86, 87, 88, 95, 96, 100]);

function color(no: number): string {
  if (no === 104) return "bg-blue-600";
  if (no === 103) return "bg-orange-500";
  if (no === 101 || no === 102) return "bg-pink-500";
  if (BLUE.has(no)) return "bg-blue-600";
  if (TEAL.has(no)) return "bg-teal-500";
  if (GREEN.has(no)) return "bg-emerald-500";
  if (RED.has(no)) return "bg-red-500";
  return "bg-gray-500";
}

const short = (n: string) => (n.length > 11 ? n.slice(0, 10) + "…" : n);

function Pill({ m }: { m?: BracketMatch }) {
  if (!m) return null;
  const finished = m.status === "finished";
  const resolved = !!m.home_team && !!m.away_team;

  return (
    <div className={cn("flex h-[46px] w-[128px] flex-col justify-center rounded-xl px-2 py-1 text-white shadow-sm", color(m.match_no))}>
      <div className="text-[11px] font-bold leading-none">M{m.match_no}</div>
      {resolved ? (
        <div className="mt-0.5 space-y-0.5">
          <div className="flex items-center justify-between gap-1 text-[9px] leading-none">
            <span className="truncate">{flagFor(m.home_team!)} {short(m.home_team!)}</span>
            {finished && <span className="font-semibold">{m.home_score}</span>}
          </div>
          <div className="flex items-center justify-between gap-1 text-[9px] leading-none">
            <span className="truncate">{flagFor(m.away_team!)} {short(m.away_team!)}</span>
            {finished && <span className="font-semibold">{m.away_score}</span>}
          </div>
        </div>
      ) : (
        <div className="mt-0.5 text-[9px] leading-tight opacity-90">
          {m.home_label} v {m.away_label}
        </div>
      )}
    </div>
  );
}

function Col({ title, nos, matches }: { title: string; nos: number[]; matches: Record<number, BracketMatch> }) {
  return (
    <div className="flex flex-none flex-col">
      <div className="mb-1 h-5 text-center text-xs font-bold text-gray-400">{title}</div>
      <div className="flex flex-col justify-around" style={{ height: H }}>
        {nos.map((no) => (
          <div key={no} className="flex items-center">
            <Pill m={matches[no]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Connector({ feederN, dir }: { feederN: number; dir: "r" | "l" }) {
  const count = feederN / 2;
  const itemH = H / feederN;
  return (
    <div className="flex flex-none flex-col">
      <div className="mb-1 h-5" />
      <div className="flex flex-col justify-around" style={{ height: H, width: 16 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            style={{ height: itemH }}
            className={cn("border-gray-300", dir === "r" ? "rounded-r-md border-y border-r" : "rounded-l-md border-y border-l")}
          />
        ))}
      </div>
    </div>
  );
}

function Center({ matches }: { matches: Record<number, BracketMatch> }) {
  return (
    <div className="flex flex-none flex-col">
      <div className="mb-1 h-5 text-center text-xs font-bold text-gray-400">F</div>
      <div className="flex flex-col items-center justify-center gap-3" style={{ height: H }}>
        <div className="text-center leading-none">
          <div className="text-3xl font-black tracking-tighter text-gray-900">26</div>
          <div className="text-[9px] font-bold tracking-widest text-gray-400">FIFA</div>
        </div>
        <Pill m={matches[104]} />
        <Pill m={matches[103]} />
      </div>
    </div>
  );
}

export default function BracketView() {
  const { data: matches, isLoading, error } = useBracket();

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-white" />;
  if (error || !matches) return <p className="text-sm text-red-500">No se pudo cargar el cuadro.</p>;

  return (
    <div className="space-y-2">
      {/* Full-bleed: breaks out of the max-w-lg shell so desktop shows the whole
          tree centered, while mobile keeps horizontal scroll. */}
      <div className="ml-[calc(50%-50vw)] w-screen overflow-x-auto pb-3">
        <div className="mx-auto flex w-max items-start gap-1 px-4">
          <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 [writing-mode:vertical-rl]">
            Pathway 1
          </span>
          <Col title="R32" nos={LEFT.r32} matches={matches} />
          <Connector feederN={8} dir="r" />
          <Col title="R16" nos={LEFT.r16} matches={matches} />
          <Connector feederN={4} dir="r" />
          <Col title="QF" nos={LEFT.qf} matches={matches} />
          <Connector feederN={2} dir="r" />
          <Col title="SF" nos={LEFT.sf} matches={matches} />
          <Center matches={matches} />
          <Col title="SF" nos={RIGHT.sf} matches={matches} />
          <Connector feederN={2} dir="l" />
          <Col title="QF" nos={RIGHT.qf} matches={matches} />
          <Connector feederN={4} dir="l" />
          <Col title="R16" nos={RIGHT.r16} matches={matches} />
          <Connector feederN={8} dir="l" />
          <Col title="R32" nos={RIGHT.r32} matches={matches} />
          <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 [writing-mode:vertical-rl]">
            Pathway 2
          </span>
        </div>
      </div>
      <p className="text-center text-[11px] text-gray-400">Deslizá horizontalmente para ver todo el cuadro →</p>
    </div>
  );
}

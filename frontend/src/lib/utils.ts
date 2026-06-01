import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  parseISO,
  format,
  isToday,
  isTomorrow,
} from "date-fns";
import { es } from "date-fns/locale";
import type { Match } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse an ISO UTC string into a Date (rendered in the browser's local tz). */
export function toLocalTime(iso: string): Date {
  return parseISO(iso);
}

export function formatMatchTime(iso: string): string {
  return format(parseISO(iso), "HH:mm");
}

export function formatMatchDate(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return "Hoy";
  if (isTomorrow(d)) return "Mañana";
  return format(d, "d 'de' MMMM", { locale: es });
}

export function formatFullDate(iso: string): string {
  return format(parseISO(iso), "d MMM · HH:mm", { locale: es });
}

/** Predictions lock 1 hour before kickoff. */
export function isLockExpired(kickoffIso: string): boolean {
  const lockAt = parseISO(kickoffIso).getTime() - 60 * 60 * 1000;
  return Date.now() >= lockAt;
}

export function timeUntilLock(kickoffIso: string): string {
  const lockAt = parseISO(kickoffIso).getTime() - 60 * 60 * 1000;
  const mins = Math.max(0, Math.round((lockAt - Date.now()) / 60000));
  if (mins <= 0) return "Cerrada";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `Cierra en ${h}h ${m}m`;
  return `Cierra en ${m}m`;
}

/** Group matches by local calendar day → Map keyed yyyy-MM-dd, value Match[]. */
export function groupMatchesByDay(matches: Match[]): Map<string, Match[]> {
  const map = new Map<string, Match[]>();
  const sorted = [...matches].sort(
    (a, b) => parseISO(a.kickoff_at).getTime() - parseISO(b.kickoff_at).getTime(),
  );
  for (const m of sorted) {
    const key = format(parseISO(m.kickoff_at), "yyyy-MM-dd");
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  return map;
}

export function timezoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

// ---- localStorage session helpers -------------------------------------
// JWT-based auth. We store the bearer token, the logged-in user (JSON) and
// the currently-selected prode (a user can be in several).

const K_TOKEN = "m26_token";
const K_USER = "m26_user";
const K_SELECTED = "m26_selected_group";

export interface SessionUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  avatar_emoji: string;
  is_admin: boolean;
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

export const getToken = () => read(K_TOKEN);

export function getUser(): SessionUser | null {
  const raw = read(K_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export const getUserId = (): string | null => {
  const u = getUser();
  return u ? String(u.id) : null;
};

export const isAdmin = (): boolean => !!getUser()?.is_admin;

export const getSelectedGroupId = () => read(K_SELECTED);

export function setSelectedGroupId(groupId: string | number | null) {
  if (typeof window === "undefined") return;
  if (groupId == null) window.localStorage.removeItem(K_SELECTED);
  else window.localStorage.setItem(K_SELECTED, String(groupId));
}

export function saveAuth(token: string, user: SessionUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(K_TOKEN, token);
  window.localStorage.setItem(K_USER, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  [K_TOKEN, K_USER, K_SELECTED].forEach((k) => window.localStorage.removeItem(k));
}

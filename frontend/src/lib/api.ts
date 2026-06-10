import axios from "axios";
import useSWR, { type SWRConfiguration } from "swr";
import type {
  Match,
  AIPrediction,
  AIResult,
  Team,
  Player,
  Group,
  Column,
  Prediction,
  LeaderboardEntry,
  MatchEvent,
  News,
  Member,
  PlayerEvent,
} from "@/types";
import { getToken, getSelectedGroupId, saveAuth, type SessionUser } from "@/lib/utils";
import { flagFor } from "@/lib/flags";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const http = axios.create({ baseURL });

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// ---- Adapters: backend shapes → frontend domain types ----------------

function shorten(name: string): string {
  return name.length > 12 ? name.slice(0, 11) + "." : name;
}

function teamStub(id: number | null | undefined, name: string | null | undefined): Team {
  const n = name || "TBD";
  return {
    id: id ?? 0,
    external_id: id ?? null,
    name: n,
    short_name: shorten(n),
    flag_emoji: flagFor(n),
    logo_url: null,
    group: null,
    coach: null,
  };
}

interface BackendMatch {
  id: number;
  home_team: string;
  away_team: string;
  home_team_id: number | null;
  away_team_id: number | null;
  kickoff_utc: string;
  status: Match["status"];
  minute: number | null;
  phase: string | null;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
  home_possession: number | null;
  away_possession: number | null;
  home_shots: number | null;
  away_shots: number | null;
  home_xg: number | null;
  away_xg: number | null;
  home_yellows: number;
  away_yellows: number;
  home_reds: number;
  away_reds: number;
  scorers: string[] | null;
  booked: string[] | null;
  red_players: string[] | null;
}

function adaptMatch(m: BackendMatch): Match {
  return {
    id: m.id,
    home_team_id: m.home_team_id ?? 0,
    away_team_id: m.away_team_id ?? 0,
    home_team: teamStub(m.home_team_id, m.home_team),
    away_team: teamStub(m.away_team_id, m.away_team),
    kickoff_at: m.kickoff_utc,
    status: m.status,
    minute: m.minute,
    phase: m.phase,
    venue: m.venue,
    home_score: m.home_score,
    away_score: m.away_score,
    home_possession: m.home_possession,
    away_possession: m.away_possession,
    home_shots: m.home_shots,
    away_shots: m.away_shots,
    home_shots_on_target: null,
    away_shots_on_target: null,
    home_xg: m.home_xg,
    away_xg: m.away_xg,
    home_passes: null,
    away_passes: null,
    home_yellows: m.home_yellows ?? 0,
    away_yellows: m.away_yellows ?? 0,
    home_reds: m.home_reds ?? 0,
    away_reds: m.away_reds ?? 0,
    scorers: m.scorers ?? [],
    booked: m.booked ?? [],
    red_players: m.red_players ?? [],
    ai_prediction: null,
    events: [],
  };
}

const RESULT_MAP: Record<string, AIResult> = { home: "local", draw: "empate", away: "visitante" };

interface BackendAI {
  id: number;
  match_id: number;
  result: string;
  score_home: number;
  score_away: number;
  confidence: number;
  prob_home: number;
  prob_draw: number;
  prob_away: number;
  xg_home: number;
  xg_away: number;
  key_players: string[];
  factors: string[];
  summary_text: string | null;
  generated_at: string;
}

function adaptAI(a: BackendAI): AIPrediction {
  return {
    id: a.id,
    match_id: a.match_id,
    result: RESULT_MAP[a.result] ?? "empate",
    suggested_score: `${a.score_home}-${a.score_away}`,
    confidence: a.confidence,
    prob_home: a.prob_home,
    prob_draw: a.prob_draw,
    prob_away: a.prob_away,
    expected_goals_home: a.xg_home,
    expected_goals_away: a.xg_away,
    key_players: JSON.stringify(a.key_players ?? []),
    decisive_factors: JSON.stringify(a.factors ?? []),
    summary: a.summary_text ?? "",
    generated_at: a.generated_at,
  };
}

interface BackendScore {
  pts_result: number;
  pts_exact: number;
  pts_yellows: number;
  pts_reds: number;
  pts_bonus: number;
  pts_scorers: number;
  pts_cards: number;
  total: number;
}
interface BackendPrediction {
  id: number;
  user_id: number;
  match_id: number;
  column_id: number;
  pred_home_score: number;
  pred_away_score: number;
  pred_yellows: number;
  pred_reds: number;
  pred_scorers: string[] | null;
  pred_cards: string[] | null;
  pred_players: PlayerEvent[] | null;
  locked: boolean;
  score: BackendScore | null;
}

function adaptPrediction(p: BackendPrediction): Prediction {
  const s = p.score;
  return {
    id: p.id,
    user_id: p.user_id,
    match_id: p.match_id,
    column_id: p.column_id,
    pred_home_score: p.pred_home_score,
    pred_away_score: p.pred_away_score,
    pred_yellows: p.pred_yellows,
    pred_reds: p.pred_reds,
    pred_scorers: p.pred_scorers ?? [],
    pred_cards: p.pred_cards ?? [],
    pred_players: p.pred_players ?? [],
    pts_result: s?.pts_result ?? 0,
    pts_goals: s?.pts_exact ?? 0,
    pts_yellows_scored: s?.pts_yellows ?? 0,
    pts_reds_scored: s?.pts_reds ?? 0,
    pts_exact_score: s?.pts_bonus ?? 0,
    pts_scorers: s?.pts_scorers ?? 0,
    pts_cards: s?.pts_cards ?? 0,
    total_points: s?.total ?? 0,
    is_scored: s != null,
    locked_at: p.locked ? "locked" : null,
  };
}

interface BackendColumn {
  id: number;
  name: string;
  status: Column["status"];
  starts_at: string | null;
  closes_at: string | null;
  scoring_config: Record<string, number>;
}

function adaptColumn(c: BackendColumn): Column {
  const cfg = c.scoring_config ?? {};
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    starts_at: c.starts_at,
    ends_at: c.closes_at,
    pts_result: cfg.pts_result ?? 0,
    pts_goals: cfg.pts_exact_goals ?? 0,
    pts_yellows: cfg.pts_yellows ?? 0,
    pts_reds: cfg.pts_reds ?? 0,
    pts_exact_score: cfg.pts_bonus ?? 0,
  };
}

interface BackendLeaderEntry {
  user_id: number;
  name: string;
  avatar_emoji: string;
  points: number;
  delta_today: number;
  streak: number;
  rank: number;
}

function adaptLeaderEntry(e: BackendLeaderEntry): LeaderboardEntry {
  return {
    rank: e.rank,
    user_id: e.user_id,
    name: e.name,
    avatar_emoji: e.avatar_emoji,
    total_points: e.points,
    correct_results: 0,
    exact_scores: 0,
    delta_today: e.delta_today ?? 0,
    streak: e.streak ?? 0,
  };
}

// ---- Query hooks ------------------------------------------------------

const hasLive = (matches?: Match[]) => !!matches?.some((m) => m.status === "live");

export function useMatches(params?: { date?: string; status?: string }) {
  const qs = new URLSearchParams({ page_size: "200" });
  if (params?.date) qs.set("date", params.date);
  if (params?.status) qs.set("status", params.status);
  const key = `/matches?${qs.toString()}`;
  const config: SWRConfiguration = {
    refreshInterval: (latest: Match[] | undefined) => (hasLive(latest) ? 30000 : 60000),
  };
  return useSWR<Match[]>(
    key,
    (url: string) => http.get(url).then((r) => (r.data.items ?? []).map(adaptMatch)),
    config,
  );
}

export function useMatch(id: string | number | null) {
  return useSWR<Match>(
    id ? `/matches/${id}` : null,
    async (url: string) => {
      const [matchRes, eventsRes] = await Promise.all([
        http.get(url),
        http.get(`${url}/events`).catch(() => ({ data: [] as MatchEvent[] })),
      ]);
      const match = adaptMatch(matchRes.data);
      match.events = (eventsRes.data ?? []).map((e: Partial<MatchEvent>, i: number) => ({
        id: i,
        match_id: match.id,
        type: (e.type as MatchEvent["type"]) ?? "Goal",
        minute: e.minute ?? 0,
        team_id: 0,
        player_name: (e as { player?: string }).player ?? e.player_name ?? "",
        detail: e.detail ?? null,
      }));
      return match;
    },
    { refreshInterval: (latest: Match | undefined) => (latest?.status === "live" ? 30000 : 0) },
  );
}

export function useAIPrediction(matchId: string | number | null) {
  return useSWR<AIPrediction>(
    matchId ? `/ai/match/${matchId}` : null,
    (url: string) => http.get(url).then((r) => adaptAI(r.data)),
    { shouldRetryOnError: false },
  );
}

export interface BracketMatch {
  match_no: number;
  round: string;
  home_label: string;
  away_label: string;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  venue: string | null;
}

export function useBracket() {
  return useSWR<Record<number, BracketMatch>>("/bracket", (url: string) =>
    http.get(url).then((r) => r.data.matches as Record<number, BracketMatch>),
  );
}

export function useStandings() {
  return useSWR<Team[]>("/standings", (url: string) =>
    http.get(url).then((r) =>
      (r.data.items ?? []).map((t: Team) => ({ ...t, flag_emoji: flagFor(t.name) })),
    ),
  );
}

export interface ScorerStat {
  name: string;
  team: string | null;
  photo_url: string | null;
  goals: number;
  yellows: number;
  reds: number;
}

export interface TeamStat {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  yellows: number;
  reds: number;
  points: number;
}

export interface TournamentStats {
  totals: { goals: number; matches: number; yellows: number; reds: number; avg_goals: number };
  scorers: ScorerStat[];
  teams: TeamStat[];
}

export function useTournamentStats() {
  return useSWR<TournamentStats>("/stats/tournament", (url: string) =>
    http.get(url).then((r) => r.data as TournamentStats),
  );
}

export function useTeam(id: string | number | null) {
  const { data, error, isLoading } = useSWR(
    id ? `/teams/${id}` : null,
    async (url: string) => {
      const [teamRes, matchesRes] = await Promise.all([
        http.get(url),
        http.get(`${url}/matches`).catch(() => ({ data: { items: [] } })),
      ]);
      return { team: teamRes.data, matches: matchesRes.data.items ?? [] };
    },
  );

  const raw = data?.team;
  const stats = raw?.statistics ?? {};
  const name = raw?.team?.team?.name ?? raw?.team?.name ?? "";
  const team: Team | undefined = raw
    ? {
        id: Number(id),
        external_id: Number(id),
        name,
        short_name: shorten(name),
        flag_emoji: flagFor(name),
        logo_url: raw?.team?.team?.logo ?? null,
        group: null,
        coach: null,
        goals_for: stats?.goals?.for?.total?.total ?? undefined,
        goals_against: stats?.goals?.against?.total?.total ?? undefined,
        xg_for: 0,
        possession: 0,
        form: stats?.form,
        players: [],
      }
    : undefined;

  const recentMatches: Match[] = (data?.matches ?? []).map(adaptApiFixture);
  return { team, recentMatches, error, isLoading };
}

interface ApiFixture {
  fixture?: { id?: number; date?: string; status?: { short?: string } };
  teams?: { home?: { id?: number; name?: string }; away?: { id?: number; name?: string } };
  goals?: { home?: number | null; away?: number | null };
}

function adaptApiFixture(fx: ApiFixture): Match {
  const short = fx.fixture?.status?.short ?? "NS";
  const status: Match["status"] = ["FT", "AET", "PEN"].includes(short)
    ? "finished"
    : ["1H", "2H", "HT", "ET", "LIVE"].includes(short)
      ? "live"
      : "scheduled";
  return {
    ...teamStubMatch(),
    id: fx.fixture?.id ?? 0,
    home_team: teamStub(fx.teams?.home?.id, fx.teams?.home?.name),
    away_team: teamStub(fx.teams?.away?.id, fx.teams?.away?.name),
    home_team_id: fx.teams?.home?.id ?? 0,
    away_team_id: fx.teams?.away?.id ?? 0,
    kickoff_at: fx.fixture?.date ?? new Date().toISOString(),
    status,
    home_score: fx.goals?.home ?? null,
    away_score: fx.goals?.away ?? null,
  };
}

function teamStubMatch(): Match {
  return {
    id: 0,
    home_team_id: 0,
    away_team_id: 0,
    home_team: teamStub(0, "TBD"),
    away_team: teamStub(0, "TBD"),
    kickoff_at: new Date().toISOString(),
    status: "scheduled",
    minute: null,
    phase: null,
    venue: null,
    home_score: null,
    away_score: null,
    home_possession: null,
    away_possession: null,
    home_shots: null,
    away_shots: null,
    home_shots_on_target: null,
    away_shots_on_target: null,
    home_xg: null,
    away_xg: null,
    home_passes: null,
    away_passes: null,
    home_yellows: 0,
    away_yellows: 0,
    home_reds: 0,
    away_reds: 0,
    ai_prediction: null,
    events: [],
  };
}

export function usePlayer(id: string | number | null) {
  return useSWR<Player>(id ? `/players/${id}` : null, async (url: string) => {
    const res = await http.get(url);
    const p = res.data.player ?? {};
    const info = p.player ?? {};
    const st = (p.statistics ?? [])[0] ?? {};
    return {
      id: Number(id),
      team_id: st?.team?.id ?? 0,
      name: info.name ?? "Jugador",
      position: st?.games?.position ?? "",
      number: st?.games?.number ?? null,
      age: info.age ?? null,
      nationality: info.nationality ?? null,
      photo_url: info.photo ?? null,
      goals: st?.goals?.total ?? 0,
      assists: st?.goals?.assists ?? 0,
      yellow_cards: st?.cards?.yellow ?? 0,
      red_cards: st?.cards?.red ?? 0,
      minutes_played: st?.games?.minutes ?? 0,
      rating: st?.games?.rating ? parseFloat(st.games.rating) : null,
      xg: null,
    } as Player;
  });
}

export function useGroup(groupId: string | number | null) {
  return useSWR<Group>(groupId ? `/groups/${groupId}` : null, (url: string) =>
    http.get(url).then((r) => r.data as Group),
  );
}

export function useGroupColumns(groupId: string | number | null) {
  return useSWR<Column[]>(groupId ? `/groups/${groupId}/columns` : null, (url: string) =>
    http.get(url).then((r) => (r.data ?? []).map(adaptColumn)),
  );
}

export function useAdminColumns() {
  return useSWR<Column[]>("/admin/columns", (url: string) =>
    http.get(url).then((r) => (r.data ?? []).map(adaptColumn)),
  );
}

export function useLeaderboard(groupId: string | number | null) {
  return useSWR<LeaderboardEntry[]>(
    groupId ? `/groups/${groupId}/leaderboard` : null,
    (url: string) => http.get(url).then((r) => (r.data.entries ?? []).map(adaptLeaderEntry)),
    { refreshInterval: 60000 },
  );
}

export interface BreakdownMember {
  user_id: number;
  name: string;
  avatar_emoji: string;
}
export interface BreakdownMatch {
  id: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  phase: string | null;
  kickoff_utc: string | null;
  points: Record<string, number>;
}
export interface GroupBreakdown {
  members: BreakdownMember[];
  matches: BreakdownMatch[];
}

export function useBreakdown(groupId: string | number | null) {
  return useSWR<GroupBreakdown>(
    groupId ? `/groups/${groupId}/breakdown` : null,
    (url: string) => http.get(url).then((r) => r.data as GroupBreakdown),
  );
}

export function usePredictions() {
  const token = getToken();
  return useSWR<Prediction[]>(token ? "/predictions" : null, (url: string) =>
    http.get(url).then((r) => (r.data ?? []).map(adaptPrediction)),
  );
}

/** Resolve the group's active column (reactive). */
export function useActiveColumnId(): number | null {
  const { data: columns } = useGroupColumns(getSelectedGroupId());
  if (!columns || columns.length === 0) return null;
  const active = columns.find((c) => c.status === "active") ?? columns[0];
  return active?.id ?? null;
}

// ---- Mutations --------------------------------------------------------

export async function generateAIPrediction(matchId: string | number): Promise<AIPrediction> {
  const res = await http.get(`/ai/match/${matchId}?force=true`);
  return adaptAI(res.data);
}

export interface SubmitPredictionBody {
  match_id: number;
  column_id: number;
  pred_home_score: number;
  pred_away_score: number;
  pred_yellows: number;
  pred_reds: number;
  pred_players?: PlayerEvent[];
}

export async function submitPrediction(body: SubmitPredictionBody): Promise<Prediction> {
  const res = await http.post(`/predictions`, body);
  return adaptPrediction(res.data);
}

// ---- Prode al goleador (tournament top scorer) --------------------------

export interface TopScorerState {
  column_id: number;
  pick: string | null;
  team_name: string | null;
  leader: { name: string; goals: number } | null;
  finished: boolean;
  points_value: number;
}

export function useTopScorer(columnId: number | null) {
  return useSWR<TopScorerState>(
    columnId ? `/predictions/top-scorer?column_id=${columnId}` : null,
    (url: string) => http.get(url).then((r) => r.data as TopScorerState),
  );
}

export async function submitTopScorer(
  columnId: number,
  playerName: string,
  teamName?: string | null,
): Promise<TopScorerState> {
  const res = await http.post(`/predictions/top-scorer`, {
    column_id: columnId,
    player_name: playerName,
    team_name: teamName ?? null,
  });
  return res.data as TopScorerState;
}

// ---- Campeón del torneo -------------------------------------------------

export interface ChampionState {
  column_id: number;
  pick: string | null;
  champion: string | null;
  started: boolean;
  finished: boolean;
  points_value: number;
}

export function useChampion(columnId: number | null) {
  return useSWR<ChampionState>(
    columnId ? `/predictions/champion?column_id=${columnId}` : null,
    (url: string) => http.get(url).then((r) => r.data as ChampionState),
  );
}

export async function submitChampion(columnId: number, teamName: string): Promise<ChampionState> {
  const res = await http.post(`/predictions/champion`, { column_id: columnId, team_name: teamName });
  return res.data as ChampionState;
}

// ---- App settings (feature flags) ---------------------------------------

export interface AppSettings {
  ai_enabled: boolean;
}

export function useSettings() {
  return useSWR<AppSettings>("/settings", (url: string) => http.get(url).then((r) => r.data as AppSettings), {
    revalidateOnFocus: false,
  });
}

export async function setSetting(key: string, value: unknown): Promise<AppSettings> {
  const res = await http.put(`/admin/settings`, { key, value });
  return res.data as AppSettings;
}

// ---- Contact -----------------------------------------------------------

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  handled: boolean;
  created_at: string;
}

export async function sendContact(body: { name: string; email: string; message: string }): Promise<void> {
  await http.post(`/contact`, body);
}

export function useContactMessages() {
  return useSWR<ContactMessage[]>("/admin/contact", (url: string) =>
    http.get(url).then((r) => r.data as ContactMessage[]),
  );
}

export async function toggleContactHandled(id: number): Promise<void> {
  await http.post(`/admin/contact/${id}/handled`);
}

export async function markAllContactRead(): Promise<void> {
  await http.post(`/admin/contact/read-all`);
}

export async function deleteContact(id: number): Promise<void> {
  await http.delete(`/admin/contact/${id}`);
}

export interface PlayerSearchResult {
  id: number;
  name: string;
  team: string;
  position: string | null;
  photo_url: string | null;
}

export async function searchPlayers(q: string): Promise<PlayerSearchResult[]> {
  const res = await http.get(`/players-search`, { params: { q, limit: 20 } });
  return (res.data?.players ?? []) as PlayerSearchResult[];
}

// ---- Account auth -------------------------------------------------------

export interface RegisterBody {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  age?: number | null;
  email: string;
  avatar_emoji?: string;
}

export async function register(body: RegisterBody): Promise<SessionUser> {
  const res = await http.post(`/auth/register`, body);
  saveAuth(res.data.token, res.data.user as SessionUser);
  return res.data.user as SessionUser;
}

export async function login(username: string, password: string): Promise<SessionUser> {
  const res = await http.post(`/auth/login`, { username, password });
  saveAuth(res.data.token, res.data.user as SessionUser);
  return res.data.user as SessionUser;
}

/** Create a new prode; returns its group. */
export async function createProde(name: string): Promise<Group> {
  const res = await http.post(`/groups`, { name });
  return res.data as Group;
}

/** Request to join a prode by invite code; returns {group_id, status}. */
export async function joinProde(code: string): Promise<{ group_id: number; status: string }> {
  const res = await http.post(`/groups/${code.toUpperCase()}/join`);
  return res.data;
}

// ---- Admin management ---------------------------------------------------

export function useAdmins() {
  return useSWR<SessionUser[]>("/admin/admins", (url: string) => http.get(url).then((r) => r.data));
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  age: number | null;
  is_admin: boolean;
  created_at: string;
  prodes: number;
}

export interface AdminUsersPage {
  items: AdminUser[];
  total: number;
  page: number;
  page_size: number;
}

export function useAdminUsers(q: string, page: number, pageSize = 10) {
  return useSWR<AdminUsersPage>(
    `/admin/users?q=${encodeURIComponent(q)}&page=${page}&page_size=${pageSize}`,
    (url: string) => http.get(url).then((r) => r.data as AdminUsersPage),
    { keepPreviousData: true },
  );
}

export interface CreateAdminBody {
  username: string;
  password: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export async function createAdmin(body: CreateAdminBody): Promise<SessionUser> {
  const res = await http.post(`/admin/admins`, body);
  return res.data;
}

export async function revokeAdmin(userId: number): Promise<void> {
  await http.post(`/admin/admins/${userId}/revoke`);
}

/** Promote an existing registered user to admin. */
export async function makeAdmin(userId: number): Promise<void> {
  await http.post(`/admin/users/${userId}/make-admin`);
}

export interface CreateColumnBody {
  name: string;
  pts_result: number;
  pts_goals: number;
  pts_yellows: number;
  pts_reds: number;
  pts_exact_score: number;
  group_ids: number[];
}

export async function createColumn(body: CreateColumnBody): Promise<Column> {
  const res = await http.post(`/admin/columns`, {
    name: body.name,
    group_ids: body.group_ids,
    match_ids: [],
    scoring_config: {
      pts_result: body.pts_result,
      pts_exact_goals: body.pts_goals,
      pts_yellows: body.pts_yellows,
      pts_reds: body.pts_reds,
      pts_bonus: body.pts_exact_score,
    },
  });
  return adaptColumn(res.data);
}

export async function updateColumn(
  id: number,
  body: { status?: string; name?: string },
): Promise<Column> {
  if (body.status === "active") {
    const res = await http.post(`/admin/columns/${id}/activate`);
    return adaptColumn(res.data);
  }
  if (body.status === "closed") {
    const res = await http.post(`/admin/columns/${id}/close`);
    return adaptColumn(res.data);
  }
  const res = await http.put(`/admin/columns/${id}`, { name: body.name });
  return adaptColumn(res.data);
}

export async function recalculateColumn(id: number): Promise<void> {
  await http.post(`/admin/columns/${id}/recalculate`);
}

// ---- Current user --------------------------------------------------------

export interface MembershipInfo {
  group_id: number;
  group_name: string;
  invite_code: string;
  status: "active" | "pending";
  role: string;
  is_creator: boolean;
}

export interface MeData {
  user: SessionUser;
  memberships: MembershipInfo[];
}

export function useMe() {
  const token = getToken();
  return useSWR<MeData>(token ? "/auth/me" : null, (url: string) =>
    http.get(url).then((r) => r.data as MeData),
  );
}

// ---- News ----------------------------------------------------------------

export interface NewsPage {
  items: News[];
  total: number;
  page: number;
  page_size: number;
}

export function useNews(page = 1, pageSize = 10) {
  return useSWR<NewsPage>(`/news?page=${page}&page_size=${pageSize}`, (url: string) =>
    http.get(url).then((r) => r.data as NewsPage),
  );
}

export function useNewsItem(id: string | number | null) {
  return useSWR<News>(id ? `/news/${id}` : null, (url: string) =>
    http.get(url).then((r) => r.data as News),
  );
}

/** Upload an image (admin) → returns its absolute URL on the API host. */
export async function uploadMedia(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await http.post(`/admin/media`, fd);
  return `${baseURL}${res.data.path}`;
}

export interface SquadPlayer {
  id: number;
  name: string;
  position: string | null;
  number: number | null;
  age: number | null;
  photo_url: string | null;
  bio?: string | null;
  wiki_url?: string | null;
  club?: string | null;
  birth_date?: string | null;
  season_apps?: number | null;
  season_goals?: number | null;
}

export function useSquad(teamName: string | null) {
  return useSWR<{ team: string; players: SquadPlayer[] }>(
    teamName ? `/squad/${encodeURIComponent(teamName)}` : null,
    (url: string) => http.get(url).then((r) => r.data),
  );
}

export async function syncSquads(): Promise<Record<string, unknown>> {
  const res = await http.post(`/admin/squads/sync`);
  return res.data;
}

export function useAdminNews() {
  return useSWR<News[]>("/admin/news", (url: string) => http.get(url).then((r) => r.data as News[]));
}

export interface NewsBody {
  title: string;
  body: string;
  image_url?: string | null;
  author?: string | null;
  published?: boolean;
}

export async function createNews(body: NewsBody): Promise<News> {
  const res = await http.post(`/admin/news`, body);
  return res.data as News;
}

export async function updateNews(id: number, body: Partial<NewsBody>): Promise<News> {
  const res = await http.put(`/admin/news/${id}`, body);
  return res.data as News;
}

export async function deleteNews(id: number): Promise<void> {
  await http.delete(`/admin/news/${id}`);
}

// ---- Group members / approval -------------------------------------------

export function useMembers(groupId: string | number | null) {
  return useSWR<Member[]>(groupId ? `/groups/${groupId}/members` : null, (url: string) =>
    http.get(url).then((r) => r.data as Member[]),
  );
}

export async function approveMember(groupId: number, userId: number): Promise<void> {
  await http.post(`/groups/${groupId}/members/${userId}/approve`);
}

export async function rejectMember(groupId: number, userId: number): Promise<void> {
  await http.post(`/groups/${groupId}/members/${userId}/reject`);
}

// ---- Tournament simulation (demo tools) ---------------------------------

export async function simulateTournament(): Promise<{ champion?: string }> {
  const res = await http.post(`/admin/bracket/simulate`);
  return res.data;
}

export async function resetTournament(): Promise<void> {
  await http.post(`/admin/bracket/reset`);
}

// ---- Admin: manual match result -----------------------------------------

export interface MatchResultBody {
  home_score: number;
  away_score: number;
  players: PlayerEvent[];
  finished: boolean;
}

export async function setMatchResult(
  matchId: number,
  body: MatchResultBody,
): Promise<{ status: string; score: string; recalculated_predictions: number }> {
  const res = await http.post(`/admin/matches/${matchId}/result`, body);
  return res.data;
}

/** Undo a loaded result: back to scheduled, clear events and remove points. */
export async function resetMatchResult(
  matchId: number,
): Promise<{ status: string; cleared_predictions: number }> {
  const res = await http.post(`/admin/matches/${matchId}/reset-result`);
  return res.data;
}

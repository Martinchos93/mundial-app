export type MatchStatus = "scheduled" | "live" | "finished" | "postponed";
export type ColumnStatus = "draft" | "active" | "closed";
export type AIResult = "local" | "empate" | "visitante";

export interface Player {
  id: number;
  team_id: number;
  name: string;
  position: string;
  number: number | null;
  age: number | null;
  nationality: string | null;
  photo_url: string | null;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  minutes_played: number;
  rating: number | null;
  xg: number | null;
}

export interface Team {
  id: number;
  external_id: number | null;
  name: string;
  short_name: string;
  flag_emoji: string;
  logo_url: string | null;
  group: string | null;
  coach: string | null;
  players?: Player[];
  // standings (optional, present on /standings)
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goal_difference?: number;
  points?: number;
  form?: string; // recent results e.g. "WWDLW"
  rank?: number;
  qualified?: boolean;
  qualifier?: "group" | "third" | null;
  // aggregate stats (optional, present on /teams/:id)
  xg_for?: number;
  xg_against?: number;
  possession?: number;
  goals_for?: number;
  goals_against?: number;
}

export interface MatchEvent {
  id: number;
  match_id: number;
  type: "Goal" | "Card" | "subst" | "Var";
  minute: number;
  team_id: number;
  player_name: string;
  detail: string | null;
}

export interface AIPrediction {
  id: number;
  match_id: number;
  result: AIResult;
  suggested_score: string;
  confidence: number;
  prob_home: number;
  prob_draw: number;
  prob_away: number;
  expected_goals_home: number;
  expected_goals_away: number;
  key_players: string; // JSON string
  decisive_factors: string; // JSON string
  summary: string;
  generated_at: string;
}

export interface Match {
  id: number;
  home_team_id: number;
  home_team: Team;
  away_team_id: number;
  away_team: Team;
  kickoff_at: string;
  status: MatchStatus;
  minute: number | null;
  phase: string | null;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
  home_possession: number | null;
  away_possession: number | null;
  home_shots: number | null;
  away_shots: number | null;
  home_shots_on_target: number | null;
  away_shots_on_target: number | null;
  home_xg: number | null;
  away_xg: number | null;
  home_passes: number | null;
  away_passes: number | null;
  home_yellows: number;
  away_yellows: number;
  home_reds: number;
  away_reds: number;
  ai_prediction?: AIPrediction | null;
  events?: MatchEvent[];
}

export interface User {
  id: number;
  group_id: number;
  name: string;
  avatar_emoji: string;
  is_admin: boolean;
  status?: "active" | "pending";
}

export interface Group {
  id: number;
  name: string;
  invite_code: string;
  creator_id?: number | null;
  members?: User[];
}

export interface Member {
  user_id: number;
  name: string;
  avatar_emoji: string;
  status: "active" | "pending";
  is_creator: boolean;
}

export interface News {
  id: number;
  title: string;
  body: string;
  image_url: string | null;
  author: string | null;
  published: boolean;
  created_at: string;
}

export interface Column {
  id: number;
  name: string;
  status: ColumnStatus;
  starts_at: string | null;
  ends_at: string | null;
  pts_result: number;
  pts_goals: number;
  pts_yellows: number;
  pts_reds: number;
  pts_exact_score: number;
  groups?: Group[];
}

export interface Prediction {
  id: number;
  user_id: number;
  match_id: number;
  match?: Match;
  column_id: number;
  pred_home_score: number;
  pred_away_score: number;
  pred_yellows: number;
  pred_reds: number;
  pts_result: number;
  pts_goals: number;
  pts_yellows_scored: number;
  pts_reds_scored: number;
  pts_exact_score: number;
  total_points: number;
  is_scored: boolean;
  locked_at: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  name: string;
  avatar_emoji: string;
  total_points: number;
  correct_results: number;
  exact_scores: number;
  delta_today?: number;
  streak?: number;
}

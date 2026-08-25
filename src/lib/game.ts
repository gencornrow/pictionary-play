export type Phase = "lobby" | "discuss" | "draw" | "vote" | "results" | "complete";

export const DISCUSS_SECONDS = 60;
export const DRAW_SECONDS = 120;

/** Ranked-choice: 1st = 3 pts, 2nd = 2 pts, 3rd = 1 pt. */
export const RANKS = [1, 2, 3] as const;
export const rankPoints = (rank: number) => Math.max(0, 4 - rank);
export const rankLabel = (rank: number) => (rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd");


export type Game = {
  id: string;
  code: string;
  phase: string;
  round: number;
  prompt: string;
  phase_ends_at: string | null;
};

export type Team = {
  id: string;
  game_id: string;
  name: string;
  color: string;
};

export type Player = {
  id: string;
  game_id: string;
  real_name: string;
  nickname: string;
  team_id: string | null;
  is_host: boolean;
  ink_color: string;
};

export type Point = { x: number; y: number };

export type Stroke = {
  id: string;
  team_id: string;
  round: number;
  points: Point[];
  color: string;
  width: number;
};

export type Message = {
  id: string;
  team_id: string;
  round: number;
  nickname: string;
  content: string;
  created_at: string;
};

export type Vote = {
  id: string;
  round: number;
  player_id: string;
  team_id: string;
  rank: number;
};

export const TEAM_PRESETS = [
  { name: "Team Volt", color: "#1F3B5B" },
  { name: "Team Nova", color: "#4E6B88" },
  { name: "Team Ember", color: "#5D8F68" },
  { name: "Team Mint", color: "#7A95B0" },
];

export const INK_COLORS = [
  "#1F3B5B",
  "#4E6B88",
  "#6E7781",
  "#2F3438",
  "#5D8F68",
  "#7A95B0",
  "#203A5B",
  "#5F7287",
  "#3C5A78",
  "#47705C",
];

export function randomInkColor() {
  return INK_COLORS[Math.floor(Math.random() * INK_COLORS.length)]!;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length = 5) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export type Identity = { playerId: string; hostKey?: string };

const key = (code: string) => `pictionary:${code.toUpperCase()}`;

export function loadIdentity(code: string): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(code));
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export function saveIdentity(code: string, identity: Identity) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(code), JSON.stringify(identity));
}

export function secondsLeft(endsAt: string | null): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
}

export function formatClock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const NICK_ADJECTIVES = [
  "Neon", "Turbo", "Sneaky", "Cosmic", "Wobbly", "Electric", "Midnight", "Glitchy",
  "Velvet", "Rogue", "Fuzzy", "Laser", "Chaotic", "Silent", "Radical", "Plasma",
];
const NICK_NOUNS = [
  "Doodler", "Scribbler", "Bandit", "Marker", "Comet", "Pixel", "Gremlin", "Phantom",
  "Crayon", "Sketch", "Wizard", "Otter", "Falcon", "Noodle", "Cactus", "Raccoon",
];

export function randomNickname() {
  const a = NICK_ADJECTIVES[Math.floor(Math.random() * NICK_ADJECTIVES.length)];
  const n = NICK_NOUNS[Math.floor(Math.random() * NICK_NOUNS.length)];
  return `${a} ${n} ${Math.floor(Math.random() * 90) + 10}`;
}

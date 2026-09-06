// Server-only data-access layer. Picks the storage backend by environment:
//   DATA_BACKEND=local  -> Postgres at DATABASE_URL (self-hosted Docker)
//   anything else       -> Lovable Cloud database (default, used on Lovable)
// Only ever imported inside createServerFn handlers via await import().

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Game, Message, Player, Point, Stroke, Team, Vote } from "@/lib/game";

export type BackendMode = "cloud" | "local";

export type NewPlayer = {
  gameId: string;
  realName: string;
  nickname: string;
  inkColor: string;
  isHost?: boolean;
};

export type NewMessage = {
  gameId: string;
  teamId: string;
  playerId: string;
  nickname: string;
  round: number;
  content: string;
};

export type NewStroke = {
  gameId: string;
  teamId: string;
  playerId: string;
  round: number;
  points: Point[];
  color: string;
  width: number;
};

export type NewVote = {
  gameId: string;
  round: number;
  playerId: string;
  teamId: string;
  rank: number;
};

export type GamePatch = {
  phase?: string;
  phase_ends_at?: string | null;
  prompt?: string;
  round?: number;
};

export interface Backend {
  mode: BackendMode;
  createGame(code: string): Promise<Game>;
  findGameByCode(code: string): Promise<Game | null>;
  getGame(gameId: string): Promise<Game | null>;
  createPlayer(input: NewPlayer): Promise<Player>;
  listPlayers(gameId: string): Promise<Player[]>;
  listTeams(gameId: string): Promise<Team[]>;
  listVotes(gameId: string): Promise<Vote[]>;
  listStrokes(gameId: string, round: number): Promise<Stroke[]>;
  listMessages(gameId: string, round: number): Promise<Message[]>;
  updateGame(gameId: string, patch: GamePatch): Promise<void>;
  createTeams(gameId: string, teams: { name: string; color: string }[]): Promise<Team[]>;
  setPlayerTeam(playerId: string, teamId: string | null): Promise<void>;
  addMessage(input: NewMessage): Promise<Message>;
  addStroke(input: NewStroke): Promise<Stroke>;
  addVote(input: NewVote): Promise<Vote>;
  deleteVotes(ids: string[]): Promise<void>;
}

// ---------- shared helpers ----------

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

/** Local Postgres returns Date objects; normalize to ISO strings to match the cloud rows. */
function normalizeRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out as T;
}

// ---------- cloud implementation (Lovable Cloud / Supabase) ----------

function createCloudBackend(): Backend {
  let client: SupabaseClient<Database> | undefined;
  const db = () => {
    if (!client) {
      const url = process.env["SUPABASE_URL"];
      const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
      if (!url || !key) throw new Error("Cloud backend env vars are missing (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY).");
      client = createClient<Database>(url, key, {
        global: { fetch: createSupabaseFetch(key) },
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });
    }
    return client;
  };
  const must = <T>(data: T | null, error: { message: string } | null): T => {
    if (error) throw new Error(error.message);
    if (data === null) throw new Error("Unexpected empty result");
    return data;
  };

  return {
    mode: "cloud",

    async createGame(code) {
      const { data, error } = await db().from("games").insert({ code }).select().single();
      return must(data, error) as Game;
    },
    async findGameByCode(code) {
      const { data, error } = await db().from("games").select("*").eq("code", code).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Game | null) ?? null;
    },
    async getGame(gameId) {
      const { data, error } = await db().from("games").select("*").eq("id", gameId).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Game | null) ?? null;
    },
    async createPlayer(p) {
      const { data, error } = await db()
        .from("players")
        .insert({
          game_id: p.gameId,
          real_name: p.realName,
          nickname: p.nickname,
          ink_color: p.inkColor,
          is_host: p.isHost ?? false,
        })
        .select()
        .single();
      return must(data, error) as Player;
    },
    async listPlayers(gameId) {
      const { data, error } = await db().from("players").select("*").eq("game_id", gameId).order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as Player[];
    },
    async listTeams(gameId) {
      const { data, error } = await db().from("teams").select("*").eq("game_id", gameId).order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as Team[];
    },
    async listVotes(gameId) {
      const { data, error } = await db().from("votes").select("*").eq("game_id", gameId);
      if (error) throw new Error(error.message);
      return (data ?? []) as Vote[];
    },
    async listStrokes(gameId, round) {
      const { data, error } = await db()
        .from("strokes")
        .select("*")
        .eq("game_id", gameId)
        .eq("round", round)
        .order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Stroke[];
    },
    async listMessages(gameId, round) {
      const { data, error } = await db()
        .from("messages")
        .select("*")
        .eq("game_id", gameId)
        .eq("round", round)
        .order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as Message[];
    },
    async updateGame(gameId, patch) {
      const { error } = await db().from("games").update(patch).eq("id", gameId);
      if (error) throw new Error(error.message);
    },
    async createTeams(gameId, teams) {
      const { error } = await db()
        .from("teams")
        .insert(teams.map((t) => ({ game_id: gameId, name: t.name, color: t.color })));
      if (error) throw new Error(error.message);
      return this.listTeams(gameId);
    },
    async setPlayerTeam(playerId, teamId) {
      const { error } = await db().from("players").update({ team_id: teamId }).eq("id", playerId);
      if (error) throw new Error(error.message);
    },
    async addMessage(m) {
      const { data, error } = await db()
        .from("messages")
        .insert({
          game_id: m.gameId,
          team_id: m.teamId,
          player_id: m.playerId,
          nickname: m.nickname,
          round: m.round,
          content: m.content,
        })
        .select()
        .single();
      return must(data, error) as Message;
    },
    async addStroke(s) {
      const { data, error } = await db()
        .from("strokes")
        .insert({
          game_id: s.gameId,
          team_id: s.teamId,
          player_id: s.playerId,
          round: s.round,
          points: s.points as unknown as never,
          color: s.color,
          width: s.width,
        })
        .select()
        .single();
      return must(data, error) as unknown as Stroke;
    },
    async addVote(v) {
      const { data, error } = await db()
        .from("votes")
        .insert({ game_id: v.gameId, round: v.round, player_id: v.playerId, team_id: v.teamId, rank: v.rank })
        .select()
        .single();
      return must(data, error) as Vote;
    },
    async deleteVotes(ids) {
      if (ids.length === 0) return;
      const { error } = await db().from("votes").delete().in("id", ids);
      if (error) throw new Error(error.message);
    },
  };
}

// ---------- local implementation (plain Postgres via the `postgres` driver) ----------

type Sql = Awaited<ReturnType<typeof loadSql>>;

async function loadSql() {
  const { default: postgres } = await import("postgres");
  return postgres;
}

function createLocalBackend(): Backend {
  let sql: import("postgres").Sql | undefined;
  const db = async () => {
    if (!sql) {
      const url = process.env["DATABASE_URL"];
      if (!url) throw new Error("DATA_BACKEND=local requires DATABASE_URL (e.g. postgres://user:pass@db:5432/whiteboard).");
      const postgres = await loadSql();
      sql = postgres(url, { max: 10 });
    }
    return sql;
  };
  // Helper so TS keeps the Sql type without leaking it into the public API.
  void (0 as unknown as Sql);

  return {
    mode: "local",

    async createGame(code) {
      const s = await db();
      const rows = await s`INSERT INTO games (code) VALUES (${code}) RETURNING *`;
      return normalizeRow<Game>(rows[0]!);
    },
    async findGameByCode(code) {
      const s = await db();
      const rows = await s`SELECT * FROM games WHERE code = ${code} LIMIT 1`;
      return rows[0] ? normalizeRow<Game>(rows[0]) : null;
    },
    async getGame(gameId) {
      const s = await db();
      const rows = await s`SELECT * FROM games WHERE id = ${gameId} LIMIT 1`;
      return rows[0] ? normalizeRow<Game>(rows[0]) : null;
    },
    async createPlayer(p) {
      const s = await db();
      const rows = await s`
        INSERT INTO players (game_id, real_name, nickname, ink_color, is_host)
        VALUES (${p.gameId}, ${p.realName}, ${p.nickname}, ${p.inkColor}, ${p.isHost ?? false})
        RETURNING *`;
      return normalizeRow<Player>(rows[0]!);
    },
    async listPlayers(gameId) {
      const s = await db();
      const rows = await s`SELECT * FROM players WHERE game_id = ${gameId} ORDER BY created_at`;
      return rows.map((r) => normalizeRow<Player>(r));
    },
    async listTeams(gameId) {
      const s = await db();
      const rows = await s`SELECT * FROM teams WHERE game_id = ${gameId} ORDER BY created_at`;
      return rows.map((r) => normalizeRow<Team>(r));
    },
    async listVotes(gameId) {
      const s = await db();
      const rows = await s`SELECT * FROM votes WHERE game_id = ${gameId}`;
      return rows.map((r) => normalizeRow<Vote>(r));
    },
    async listStrokes(gameId, round) {
      const s = await db();
      const rows = await s`
        SELECT id, team_id, round, points, color, width
        FROM strokes WHERE game_id = ${gameId} AND round = ${round}
        ORDER BY created_at`;
      return rows.map((r) => normalizeRow<Stroke>(r));
    },
    async listMessages(gameId, round) {
      const s = await db();
      const rows = await s`
        SELECT id, team_id, round, nickname, content, created_at
        FROM messages WHERE game_id = ${gameId} AND round = ${round}
        ORDER BY created_at`;
      return rows.map((r) => normalizeRow<Message>(r));
    },
    async updateGame(gameId, patch) {
      const s = await db();
      await s`UPDATE games SET ${s(patch)} WHERE id = ${gameId}`;
    },
    async createTeams(gameId, teams) {
      const s = await db();
      await s`INSERT INTO teams ${s(teams.map((t) => ({ game_id: gameId, name: t.name, color: t.color })))}`;
      return this.listTeams(gameId);
    },
    async setPlayerTeam(playerId, teamId) {
      const s = await db();
      await s`UPDATE players SET team_id = ${teamId} WHERE id = ${playerId}`;
    },
    async addMessage(m) {
      const s = await db();
      const rows = await s`
        INSERT INTO messages (game_id, team_id, player_id, nickname, round, content)
        VALUES (${m.gameId}, ${m.teamId}, ${m.playerId}, ${m.nickname}, ${m.round}, ${m.content})
        RETURNING *`;
      return normalizeRow<Message>(rows[0]!);
    },
    async addStroke(stroke) {
      const s = await db();
      const rows = await s`
        INSERT INTO strokes (game_id, team_id, player_id, round, points, color, width)
        VALUES (${stroke.gameId}, ${stroke.teamId}, ${stroke.playerId}, ${stroke.round},
                ${s.json(stroke.points as unknown as Record<string, unknown>[])}, ${stroke.color}, ${stroke.width})
        RETURNING id, team_id, round, points, color, width`;
      return normalizeRow<Stroke>(rows[0]!);
    },
    async addVote(v) {
      const s = await db();
      const rows = await s`
        INSERT INTO votes (game_id, round, player_id, team_id, rank)
        VALUES (${v.gameId}, ${v.round}, ${v.playerId}, ${v.teamId}, ${v.rank})
        RETURNING *`;
      return normalizeRow<Vote>(rows[0]!);
    },
    async deleteVotes(ids) {
      if (ids.length === 0) return;
      const s = await db();
      await s`DELETE FROM votes WHERE id IN ${s(ids)}`;
    },
  };
}

// ---------- switch ----------

let cached: Backend | undefined;

export function getBackendMode(): BackendMode {
  return process.env["DATA_BACKEND"] === "local" ? "local" : "cloud";
}

export function getBackend(): Backend {
  if (!cached) {
    cached = getBackendMode() === "local" ? createLocalBackend() : createCloudBackend();
  }
  return cached;
}

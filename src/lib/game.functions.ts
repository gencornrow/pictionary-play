// Server functions — the browser only ever talks to these, never directly to
// a database. Which database they use (cloud vs local Postgres) is decided
// server-side by DATA_BACKEND.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const backend = () => import("@/lib/backend/backend.server").then((m) => m.getBackend());

const pointSchema = z.object({ x: z.number(), y: z.number() });

export const getBackendMode = createServerFn({ method: "GET" }).handler(async () => {
  const { getBackendMode: mode } = await import("@/lib/backend/backend.server");
  return mode();
});

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().trim().min(4).max(12),
        realName: z.string().trim().min(1).max(60),
        nickname: z.string().trim().min(1).max(40),
        inkColor: z.string().max(32),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const b = await backend();
    const game = await b.createGame(data.code);
    const player = await b.createPlayer({
      gameId: game.id,
      realName: data.realName,
      nickname: data.nickname,
      inkColor: data.inkColor,
      isHost: true,
    });
    return { game, player };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().trim().min(4).max(12),
        realName: z.string().trim().min(1).max(60),
        nickname: z.string().trim().min(1).max(40),
        inkColor: z.string().max(32),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const b = await backend();
    const game = await b.findGameByCode(data.code.toUpperCase());
    if (!game) return { game: null, player: null };
    const player = await b.createPlayer({
      gameId: game.id,
      realName: data.realName,
      nickname: data.nickname,
      inkColor: data.inkColor,
    });
    return { game, player };
  });

export const loadRoom = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ code: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const b = await backend();
    const game = await b.findGameByCode(data.code.toUpperCase());
    if (!game) return { game: null, teams: [], players: [], votes: [], strokes: [], messages: [] };
    const [teams, players, votes, strokes, messages] = await Promise.all([
      b.listTeams(game.id),
      b.listPlayers(game.id),
      b.listVotes(game.id),
      b.listStrokes(game.id, game.round),
      b.listMessages(game.id, game.round),
    ]);
    return { game, teams, players, votes, strokes, messages };
  });

export const fetchGame = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ gameId: z.string() }).parse(input))
  .handler(async ({ data }) => (await backend()).getGame(data.gameId));

export const fetchPlayers = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ gameId: z.string() }).parse(input))
  .handler(async ({ data }) => (await backend()).listPlayers(data.gameId));

export const fetchTeams = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ gameId: z.string() }).parse(input))
  .handler(async ({ data }) => (await backend()).listTeams(data.gameId));

export const fetchVotes = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ gameId: z.string() }).parse(input))
  .handler(async ({ data }) => (await backend()).listVotes(data.gameId));

export const fetchRoundData = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ gameId: z.string(), round: z.number().int() }).parse(input),
  )
  .handler(async ({ data }) => {
    const b = await backend();
    const [strokes, messages] = await Promise.all([
      b.listStrokes(data.gameId, data.round),
      b.listMessages(data.gameId, data.round),
    ]);
    return { strokes, messages };
  });

export const updateGamePhase = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        gameId: z.string(),
        phase: z.string().max(20),
        endsInSeconds: z.number().nullable(),
        prompt: z.string().max(120).optional(),
        round: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const b = await backend();
    await b.updateGame(data.gameId, {
      phase: data.phase,
      phase_ends_at:
        data.endsInSeconds === null
          ? null
          : new Date(Date.now() + data.endsInSeconds * 1000).toISOString(),
      ...(data.prompt !== undefined ? { prompt: data.prompt } : {}),
      ...(data.round !== undefined ? { round: data.round } : {}),
    });
    return { ok: true };
  });

export const createTeamsAndAssign = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        gameId: z.string(),
        teams: z.array(z.object({ name: z.string().min(1).max(40), color: z.string().max(32) })).min(2),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const b = await backend();
    const players = await b.listPlayers(data.gameId);
    const teams = await b.createTeams(data.gameId, data.teams);
    const shuffled = [...players].filter((p) => !p.is_host).sort(() => Math.random() - 0.5);
    await Promise.all([
      ...shuffled.map((p, i) => b.setPlayerTeam(p.id, teams[i % teams.length]!.id)),
      ...players.filter((p) => p.is_host).map((p) => b.setPlayerTeam(p.id, null)),
    ]);
    return { teams, players: await b.listPlayers(data.gameId) };
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        gameId: z.string(),
        teamId: z.string(),
        playerId: z.string(),
        nickname: z.string().min(1).max(40),
        round: z.number().int(),
        content: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const b = await backend();
    return b.addMessage(data);
  });

export const saveStroke = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        gameId: z.string(),
        teamId: z.string(),
        playerId: z.string(),
        round: z.number().int(),
        points: z.array(pointSchema).min(1).max(2000),
        color: z.string().max(32),
        width: z.number().gt(0).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const b = await backend();
    return b.addStroke(data);
  });

export const submitVote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        gameId: z.string(),
        round: z.number().int(),
        playerId: z.string(),
        teamId: z.string(),
        rank: z.number().int().min(1).max(3),
        replaceVoteIds: z.array(z.string()),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const b = await backend();
    await b.deleteVotes(data.replaceVoteIds);
    const vote = await b.addVote({
      gameId: data.gameId,
      round: data.round,
      playerId: data.playerId,
      teamId: data.teamId,
      rank: data.rank,
    });
    return vote;
  });

export const retractVotes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ ids: z.array(z.string()) }).parse(input))
  .handler(async ({ data }) => {
    const b = await backend();
    await b.deleteVotes(data.ids);
    return { ok: true };
  });

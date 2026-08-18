import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crown, Eraser, Timer, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Board } from "@/components/Board";
import { TeamChat } from "@/components/TeamChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  DISCUSS_SECONDS,
  DRAW_SECONDS,
  INK_COLORS,
  TEAM_PRESETS,
  formatClock,
  loadIdentity,
  secondsLeft,
  type Game,
  type Identity,
  type Message,
  type Player,
  type Point,
  type Stroke,
  type Team,
  type Vote,
} from "@/lib/game";

export const Route = createFileRoute("/game/$code")({
  head: () => ({
    meta: [
      { title: "Game room — Neon Pictionary" },
      {
        name: "description",
        content:
          "Your live Pictionary room: team chat, a shared whiteboard timer, and voting on the best drawing.",
      },
      { property: "og:title", content: "Game room — Neon Pictionary" },
      {
        property: "og:description",
        content:
          "Your live Pictionary room: team chat, a shared whiteboard timer, and voting on the best drawing.",
      },
    ],
  }),
  component: GameRoom,
});

function GameRoom() {
  const { code } = Route.useParams();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [ink, setInk] = useState(INK_COLORS[0]!);
  const [width, setWidth] = useState(5);
  const [promptDraft, setPromptDraft] = useState("");
  const [teamCount, setTeamCount] = useState(2);
  const advancing = useRef(false);

  useEffect(() => {
    setIdentity(loadIdentity(code));
  }, [code]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 300);
    return () => window.clearInterval(t);
  }, []);

  const refresh = useCallback(
    async (gameId?: string) => {
      const id = gameId ?? game?.id;
      if (!id) return;
      const [t, p, s, m, v, g] = await Promise.all([
        supabase.from("teams").select("*").eq("game_id", id).order("created_at"),
        supabase.from("players").select("*").eq("game_id", id).order("created_at"),
        supabase.from("strokes").select("*").eq("game_id", id).order("created_at"),
        supabase.from("messages").select("*").eq("game_id", id).order("created_at"),
        supabase.from("votes").select("*").eq("game_id", id),
        supabase.from("games").select("*").eq("id", id).maybeSingle(),
      ]);
      setTeams((t.data ?? []) as Team[]);
      setPlayers((p.data ?? []) as Player[]);
      setStrokes((s.data ?? []) as unknown as Stroke[]);
      setMessages((m.data ?? []) as Message[]);
      setVotes((v.data ?? []) as Vote[]);
      if (g.data) setGame(g.data as Game);
    },
    [game?.id],
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("games")
        .select("*")
        .eq("code", code.toUpperCase())
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setLoaded(true);
        return;
      }
      setGame(data as Game);
      await refresh(data.id);
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Realtime
  const gameId = game?.id;
  useEffect(() => {
    if (!gameId) return;
    const filter = `game_id=eq.${gameId}`;
    const channel = supabase
      .channel(`room-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, (payload) => {
        const row = payload.new as Game | null;
        if (row && row.id === gameId) setGame(row);
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "strokes", filter },
        (payload) => {
          const row = payload.new as unknown as Stroke;
          setStrokes((prev) => (prev.some((s) => s.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter },
        (payload) => {
          const row = payload.new as unknown as Message;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter }, () => {
        void refresh(gameId);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter }, () => {
        void refresh(gameId);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "votes", filter }, () => {
        void refresh(gameId);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gameId, refresh]);

  const me = useMemo(
    () => players.find((p) => p.id === identity?.playerId) ?? null,
    [players, identity],
  );
  const isHost = Boolean(me?.is_host);
  const myTeam = useMemo(
    () => teams.find((t) => t.id === me?.team_id) ?? null,
    [teams, me?.team_id],
  );
  const phase = game?.phase ?? "lobby";
  const round = game?.round ?? 0;
  const remaining = game?.phase_ends_at ? secondsLeft(game.phase_ends_at) : 0;
  void now;

  const roundStrokes = useCallback(
    (teamId: string) => strokes.filter((s) => s.team_id === teamId && s.round === round),
    [strokes, round],
  );

  const teamMessages = useMemo(
    () => messages.filter((m) => m.team_id === me?.team_id && m.round === round),
    [messages, me?.team_id, round],
  );

  const setPhase = useCallback(
    async (next: string, endsInSeconds: number | null, extra: Record<string, unknown> = {}) => {
      if (!gameId) return;
      await supabase
        .from("games")
        .update({
          phase: next,
          phase_ends_at:
            endsInSeconds === null ? null : new Date(Date.now() + endsInSeconds * 1000).toISOString(),
          ...extra,
        })
        .eq("id", gameId);
    },
    [gameId],
  );

  // Host drives the clock
  useEffect(() => {
    if (!isHost || !game?.phase_ends_at) return;
    if (phase !== "discuss" && phase !== "draw") return;
    if (secondsLeft(game.phase_ends_at) > 0) return;
    if (advancing.current) return;
    advancing.current = true;
    void (async () => {
      if (phase === "discuss") await setPhase("draw", DRAW_SECONDS);
      else await setPhase("vote", null);
      advancing.current = false;
    })();
  }, [isHost, phase, game?.phase_ends_at, now, setPhase]);

  const eligibleVoters = useMemo(
    () => players.filter((p) => p.team_id !== null).length,
    [players],
  );
  const roundVotes = useMemo(() => votes.filter((v) => v.round === round), [votes, round]);

  // Auto-close voting once everyone has voted
  useEffect(() => {
    if (!isHost || phase !== "vote") return;
    if (eligibleVoters === 0 || roundVotes.length < eligibleVoters) return;
    void setPhase("results", null);
  }, [isHost, phase, roundVotes.length, eligibleVoters, setPhase]);

  const assignTeams = async () => {
    if (!gameId) return;
    const presets = TEAM_PRESETS.slice(0, Math.max(2, Math.min(4, teamCount)));
    await supabase.from("teams").insert(
      presets.map((p) => ({ game_id: gameId, name: p.name, color: p.color })),
    );
    const { data: created } = await supabase
      .from("teams")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at");
    const fresh = (created ?? []) as Team[];
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    await Promise.all(
      shuffled.map((p, i) =>
        supabase
          .from("players")
          .update({ team_id: fresh[i % fresh.length]!.id })
          .eq("id", p.id),
      ),
    );
    await refresh(gameId);
    toast.success("Teams assigned");
  };

  const startRound = async () => {
    const prompt = promptDraft.trim().slice(0, 80);
    if (!prompt) {
      toast.error("Give the teams something to draw");
      return;
    }
    if (teams.length < 2) {
      toast.error("Create teams first");
      return;
    }
    await setPhase("discuss", DISCUSS_SECONDS, { prompt, round: round + 1 });
    setPromptDraft("");
  };

  const sendMessage = async (content: string) => {
    if (!gameId || !me?.team_id) return;
    await supabase.from("messages").insert({
      game_id: gameId,
      team_id: me.team_id,
      player_id: me.id,
      nickname: me.nickname,
      round,
      content,
    });
  };

  const addStroke = async (points: Point[], color: string, strokeWidth: number) => {
    if (!gameId || !me?.team_id) return;
    const optimistic: Stroke = {
      id: `local-${crypto.randomUUID()}`,
      team_id: me.team_id,
      round,
      points,
      color,
      width: strokeWidth,
    };
    setStrokes((prev) => [...prev, optimistic]);
    const { data } = await supabase
      .from("strokes")
      .insert({
        game_id: gameId,
        team_id: me.team_id,
        player_id: me.id,
        round,
        points: points as unknown as never,
        color,
        width: strokeWidth,
      })
      .select()
      .single();
    if (data) {
      setStrokes((prev) =>
        prev.map((s) => (s.id === optimistic.id ? (data as unknown as Stroke) : s)),
      );
    }
  };

  const castVote = async (teamId: string) => {
    if (!gameId || !me) return;
    const { error } = await supabase
      .from("votes")
      .upsert(
        { game_id: gameId, round, player_id: me.id, team_id: teamId },
        { onConflict: "game_id,round,player_id" },
      );
    if (error) toast.error("Vote didn't land. Try again.");
    else toast.success("Vote locked in");
    await refresh(gameId);
  };

  const myVote = roundVotes.find((v) => v.player_id === me?.id) ?? null;

  const tally = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of roundVotes) counts.set(v.team_id, (counts.get(v.team_id) ?? 0) + 1);
    return counts;
  }, [roundVotes]);

  const topScore = Math.max(0, ...teams.map((t) => tally.get(t.id) ?? 0));

  if (!loaded) {
    return <CenterNote title="Loading room…" body="Connecting to the game." />;
  }
  if (!game) {
    return (
      <CenterNote title="Room not found" body={`No game running under code ${code.toUpperCase()}.`}>
        <Link to="/" className="text-primary underline underline-offset-4">
          Back to the start
        </Link>
      </CenterNote>
    );
  }
  if (!me) {
    return (
      <CenterNote
        title="You're not in this room"
        body="Join from the home page with the room code to take a seat."
      >
        <Link to="/" className="text-primary underline underline-offset-4">
          Go join
        </Link>
      </CenterNote>
    );
  }

  const teammates = players.filter((p) => p.team_id && p.team_id === me.team_id);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="neon-panel mb-6 flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <Link to="/" className="font-display text-xl text-gradient-neon">
            Neon Pictionary
          </Link>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Room {game.code} · Round {round || "–"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {myTeam ? (
            <span
              className="rounded-full border px-3 py-1 text-sm"
              style={{ borderColor: myTeam.color, color: myTeam.color }}
            >
              {myTeam.name}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Spectating</span>
          )}
          <span className="text-sm text-muted-foreground">
            You are <strong className="text-foreground">{me.nickname}</strong>
          </span>
          {phase === "discuss" || phase === "draw" ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1 font-display text-lg">
              <Timer className="size-4 text-primary" />
              {formatClock(remaining)}
            </span>
          ) : null}
        </div>
      </header>

      {isHost ? (
        <section className="neon-panel mb-6 space-y-4 p-4">
          <h2 className="inline-flex items-center gap-2 text-lg">
            <Crown className="size-4 text-primary" /> Host controls
          </h2>
          {teams.length === 0 ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="teamCount">Number of teams</Label>
                <Input
                  id="teamCount"
                  type="number"
                  min={2}
                  max={4}
                  value={teamCount}
                  onChange={(e) => setTeamCount(Number(e.target.value))}
                  className="w-24"
                />
              </div>
              <Button variant="neonAccent" onClick={assignTeams} disabled={players.length < 2}>
                Create teams &amp; shuffle players
              </Button>
              {players.length < 2 ? (
                <span className="text-sm text-muted-foreground">Waiting for more players…</span>
              ) : null}
            </div>
          ) : null}

          {teams.length > 0 && (phase === "lobby" || phase === "results") ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 space-y-1" style={{ minWidth: "16rem" }}>
                <Label htmlFor="prompt">What should every team draw?</Label>
                <Input
                  id="prompt"
                  value={promptDraft}
                  maxLength={80}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  placeholder="A pirate walking a dinosaur"
                />
              </div>
              <Button variant="neon" onClick={startRound}>
                Start round {round + 1}
              </Button>
              <Button variant="neonOutline" onClick={assignTeams}>
                Reshuffle teams
              </Button>
            </div>
          ) : null}

          {phase === "vote" ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {roundVotes.length}/{eligibleVoters} votes in
              </span>
              <Button variant="neonOutline" onClick={() => void setPhase("results", null)}>
                Close voting now
              </Button>
            </div>
          ) : null}

          {phase === "discuss" || phase === "draw" ? (
            <Button
              variant="neonOutline"
              onClick={() =>
                void (phase === "discuss" ? setPhase("draw", DRAW_SECONDS) : setPhase("vote", null))
              }
            >
              Skip to {phase === "discuss" ? "drawing" : "voting"}
            </Button>
          ) : null}

          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer">Roster (real names — host only)</summary>
            <ul className="mt-2 space-y-1">
              {players.map((p) => (
                <li key={p.id}>
                  {p.real_name} → <span className="text-foreground">{p.nickname}</span>
                  {p.team_id ? ` · ${teams.find((t) => t.id === p.team_id)?.name ?? ""}` : ""}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}

      {phase === "lobby" ? (
        <section className="neon-panel space-y-4 p-6">
          <h2 className="text-2xl">Waiting room</h2>
          <p className="text-muted-foreground">
            Share the code <strong className="font-display text-primary">{game.code}</strong> with
            your players. Everyone shows up as their nickname only.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {teams.length === 0 ? (
              <ul className="space-y-1 text-sm">
                {players.map((p) => (
                  <li key={p.id} className="rounded-lg bg-surface-2 px-3 py-2">
                    {p.nickname}
                    {p.is_host ? " · host" : ""}
                  </li>
                ))}
              </ul>
            ) : (
              teams.map((team) => (
                <div key={team.id} className="rounded-xl border p-3" style={{ borderColor: team.color }}>
                  <h3 className="text-base" style={{ color: team.color }}>
                    {team.name}
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {players
                      .filter((p) => p.team_id === team.id)
                      .map((p) => (
                        <li key={p.id}>{p.id === me.id ? `${p.nickname} (you)` : p.nickname}</li>
                      ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {phase === "discuss" || phase === "draw" ? (
        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="neon-panel space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Prompt</p>
                <h2 className="font-display text-2xl text-gradient-neon">{game.prompt}</h2>
              </div>
              <span className="rounded-full bg-surface-2 px-3 py-1 text-sm text-muted-foreground">
                {phase === "discuss" ? "Plan it out — drawing is locked" : "Draw together!"}
              </span>
            </div>

            {myTeam ? (
              <>
                <Board
                  strokes={roundStrokes(myTeam.id)}
                  interactive={phase === "draw"}
                  inkColor={ink}
                  inkWidth={width}
                  onStroke={(points, color, w) => void addStroke(points, color, w)}
                />
                {phase === "draw" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex gap-2">
                      {INK_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Ink ${c}`}
                          onClick={() => setInk(c)}
                          className={
                            ink === c
                              ? "size-7 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-background"
                              : "size-7 rounded-full"
                          }
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Eraser className="size-4" /> brush
                      {[3, 6, 12, 24].map((w) => (
                        <Button
                          key={w}
                          size="sm"
                          variant={width === w ? "neon" : "neonOutline"}
                          onClick={() => setWidth(w)}
                        >
                          {w}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">
                You're spectating this round — the host can reshuffle teams to add you in.
              </p>
            )}
          </div>

          <aside className="neon-panel flex min-h-[26rem] flex-col p-4">
            <h3 className="text-base">
              {myTeam ? `${myTeam.name} chat` : "Team chat"}
              <span className="ml-2 text-xs text-muted-foreground">
                {teammates.map((t) => t.nickname).join(", ")}
              </span>
            </h3>
            <div className="mt-3 min-h-0 flex-1">
              <TeamChat
                messages={teamMessages}
                myNickname={me.nickname}
                disabled={phase !== "discuss" || !myTeam}
                onSend={(content) => void sendMessage(content)}
              />
            </div>
          </aside>
        </section>
      ) : null}

      {phase === "vote" || phase === "results" ? (
        <section className="space-y-4">
          <div className="neon-panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {phase === "vote" ? "Vote for the best board" : "Results"}
              </p>
              <h2 className="font-display text-2xl text-gradient-neon">{game.prompt}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {phase === "vote"
                ? "You can't vote for your own team."
                : `Round ${round} complete.`}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => {
              const count = tally.get(team.id) ?? 0;
              const isWinner = phase === "results" && count > 0 && count === topScore;
              return (
                <div
                  key={team.id}
                  className="neon-panel space-y-3 p-4"
                  style={isWinner ? { borderColor: team.color } : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="inline-flex items-center gap-2 text-lg" style={{ color: team.color }}>
                      {isWinner ? <Trophy className="size-4" /> : null}
                      {team.name}
                      {team.id === me.team_id ? (
                        <span className="text-xs text-muted-foreground">(your team)</span>
                      ) : null}
                    </h3>
                    {phase === "results" ? (
                      <span className="font-display text-lg">
                        {count} {count === 1 ? "vote" : "votes"}
                      </span>
                    ) : null}
                  </div>
                  <Board strokes={roundStrokes(team.id)} />
                  {phase === "vote" ? (
                    <Button
                      variant={myVote?.team_id === team.id ? "neon" : "neonOutline"}
                      className="w-full"
                      disabled={team.id === me.team_id}
                      onClick={() => void castVote(team.id)}
                    >
                      {team.id === me.team_id
                        ? "Can't vote for your own"
                        : myVote?.team_id === team.id
                          ? "Your vote"
                          : `Vote for ${team.name}`}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {phase === "results" && !isHost ? (
            <p className="text-center text-sm text-muted-foreground">
              Waiting for the host to start the next round…
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function CenterNote({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="neon-panel max-w-md space-y-3 p-8 text-center">
        <h1 className="font-display text-2xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        {children}
      </div>
    </main>
  );
}

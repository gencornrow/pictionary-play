import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Palette, Users, Vote as VoteIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { randomCode, randomInkColor, randomNickname, saveIdentity } from "@/lib/game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neon Pictionary — Team Drawing Party Game" },
      {
        name: "description",
        content:
          "Host a live Pictionary battle: teams chat for a minute, draw together for two, then vote on the best board.",
      },
      { property: "og:title", content: "Neon Pictionary — Team Drawing Party Game" },
      {
        property: "og:description",
        content:
          "Host a live Pictionary battle: teams chat for a minute, draw together for two, then vote on the best board.",
      },
    ],
  }),
  component: Landing,
});

const nameSchema = z.object({
  realName: z.string().trim().min(1, "Enter your real name").max(40, "Keep it under 40 characters"),
  nickname: z
    .string()
    .trim()
    .max(24, "Keep it under 24 characters")
    .transform((value) => (value.length > 0 ? value : randomNickname())),
});

function Landing() {
  const navigate = useNavigate();
  const [realName, setRealName] = useState("");
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  const names = () => {
    const parsed = nameSchema.safeParse({ realName, nickname });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return null;
    }
    return parsed.data;
  };

  const hostGame = async () => {
    const parsed = names();
    if (!parsed) return;
    setBusy(true);
    try {
      const code = randomCode();
      const { data: game, error } = await supabase
        .from("games")
        .insert({ code })
        .select()
        .single();
      if (error || !game) throw error ?? new Error("Could not create the room");

      const { data: player, error: playerError } = await supabase
        .from("players")
        .insert({
          game_id: game.id,
          real_name: parsed.realName,
          nickname: parsed.nickname,
          ink_color: randomInkColor(),
          is_host: true,
        })
        .select()
        .single();
      if (playerError || !player) throw playerError ?? new Error("Could not join the room");

      saveIdentity(code, { playerId: player.id, hostKey: game.host_key });
      await navigate({ to: "/game/$code", params: { code } });
    } catch (err) {
      console.error("[host] create room failed:", err);
      toast.error("Could not create the room. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const joinGame = async () => {
    const parsed = names();
    if (!parsed) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      toast.error("Enter the room code your host shared");
      return;
    }
    setBusy(true);
    try {
      const { data: game } = await supabase
        .from("games")
        .select("id, code")
        .eq("code", code)
        .maybeSingle();
      if (!game) {
        toast.error("No room with that code");
        return;
      }
      const { data: player, error } = await supabase
        .from("players")
        .insert({
          game_id: game.id,
          real_name: parsed.realName,
          nickname: parsed.nickname,
          ink_color: randomInkColor(),
        })
        .select()
        .single();
      if (error || !player) throw error ?? new Error("join failed");
      saveIdentity(code, { playerId: player.id });
      await navigate({ to: "/game/$code", params: { code } });
    } catch (err) {
      console.error("[join] join room failed:", err);
      toast.error("Could not join that room. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-10 px-5 py-14">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-primary">
          live team drawing
        </span>
        <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl">
          <span className="text-gradient-neon">Neon Pictionary</span>
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Everyone joins under a fake nickname. Teams get 1 minute to scheme in private chat, 2
          minutes to draw the host's prompt together on one shared whiteboard — then everyone votes
          for the best board (except their own).
        </p>
        <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-2">
            <Users className="size-4 text-primary" /> Nickname-only teams
          </li>
          <li className="inline-flex items-center gap-2">
            <Palette className="size-4 text-accent" /> Shared live canvas
          </li>
          <li className="inline-flex items-center gap-2">
            <VoteIcon className="size-4 text-primary" /> Anonymous-ish voting
          </li>
        </ul>
      </header>

      <section className="neon-panel grid gap-6 p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="realName">Your real name</Label>
            <Input
              id="realName"
              value={realName}
              maxLength={40}
              onChange={(e) => setRealName(e.target.value)}
              placeholder="Dwaine Austin"
            />
            <p className="text-xs text-muted-foreground">Only the host can see this.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Your fake nickname</Label>
            <Input
              id="nickname"
              value={nickname}
              maxLength={24}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Doodle Bandit"
            />
            <p className="text-xs text-muted-foreground">
              This is all your teammates see. Leave it blank and we'll invent one for you.
            </p>
          </div>
        </div>

        <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg">Host a room</h2>
            <Button variant="neon" size="lg" className="w-full" disabled={busy} onClick={hostGame}>
              Create room
            </Button>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg">Join a room</h2>
            <div className="flex gap-2">
              <Input
                value={joinCode}
                maxLength={8}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                className="uppercase tracking-[0.3em]"
              />
              <Button variant="neonAccent" size="lg" disabled={busy} onClick={joinGame}>
                Join
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

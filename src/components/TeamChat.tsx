import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Message } from "@/lib/game";

type TeamChatProps = {
  messages: Message[];
  myNickname: string;
  disabled?: boolean;
  onSend: (content: string) => void;
};

export function TeamChat({ messages, myNickname, disabled, onSend }: TeamChatProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No messages yet. Plan the drawing with your team — only teammates see this.
          </p>
        ) : null}
        {messages.map((m) => {
          const mine = m.nickname === myNickname;
          return (
            <div key={m.id} className={mine ? "text-right" : "text-left"}>
              <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                {mine ? "you" : m.nickname}
              </span>
              <span
                className={
                  mine
                    ? "inline-block max-w-[85%] rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                    : "inline-block max-w-[85%] rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-foreground"
                }
              >
                {m.content}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = draft.trim().slice(0, 300);
          if (!value || disabled) return;
          onSend(value);
          setDraft("");
        }}
      >
        <Input
          value={draft}
          maxLength={300}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={disabled ? "Chat is closed" : "Message your team…"}
        />
        <Button type="submit" variant="neon" size="icon" disabled={disabled}>
          <Send />
        </Button>
      </form>
    </div>
  );
}

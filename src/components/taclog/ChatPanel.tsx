import { useRef, useEffect } from "react";
import type { ChatMessage } from "@/lib/taclog-data";

interface ChatPanelProps {
  chat: ChatMessage[];
  chatIn: string;
  setChatIn: (v: string) => void;
  chatLoad: boolean;
  onSend: () => void;
}

export default function ChatPanel({ chat, chatIn, setChatIn, chatLoad, onSend }: ChatPanelProps) {
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto p-2.5">
        {chat.map((m, i) => (
          <div key={i} className="mb-2.5">
            <div
              className="text-[9px] uppercase tracking-[1px] mb-0.5"
              style={{
                color: m.role === "user"
                  ? "hsl(var(--tac-blue))"
                  : m.role === "system"
                    ? "hsl(var(--tac-green) / 0.4)"
                    : "hsl(var(--tac-green) / 0.7)",
              }}
            >
              {m.role === "user" ? "You" : m.role === "system" ? "System" : "TACLOG AI"}
            </div>
            <div
              className="text-[11px] leading-relaxed whitespace-pre-wrap break-words"
              style={{
                color: m.role === "system"
                  ? "hsl(var(--tac-green) / 0.35)"
                  : "hsl(var(--foreground))",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {chatLoad && <div className="text-primary/40 text-[10px] italic">Analyzing...</div>}
        <div ref={chatEnd} />
      </div>

      <div className="p-2 border-t border-border flex gap-1">
        <input
          value={chatIn}
          onChange={e => setChatIn(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onSend()}
          placeholder="Ask about logistics..."
          className="flex-1 bg-background border border-border text-foreground px-2 py-1.5 font-mono text-[11px] outline-none focus:border-primary/50 transition-colors"
        />
        <button
          onClick={onSend}
          disabled={chatLoad}
          className="px-2.5 py-1.5 bg-primary/15 border border-primary/30 text-primary cursor-pointer font-mono text-[10px] disabled:opacity-40 disabled:cursor-wait hover:bg-primary/25 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}

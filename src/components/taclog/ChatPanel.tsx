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
          <div key={i} className="mb-3">
            <div
              className="text-[9px] uppercase tracking-[1px] mb-0.5 font-semibold"
              style={{
                color: m.role === "user"
                  ? "hsl(var(--tac-blue))"
                  : m.role === "system"
                    ? "hsl(var(--muted-foreground))"
                    : "hsl(var(--primary))",
              }}
            >
              {m.role === "user" ? "You" : m.role === "system" ? "System" : "TACLOG AI"}
            </div>
            <div
              className="text-xs leading-relaxed whitespace-pre-wrap break-words"
              style={{
                color: m.role === "system"
                  ? "hsl(var(--muted-foreground))"
                  : "hsl(var(--foreground))",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {chatLoad && <div className="text-primary text-[11px] italic">Analyzing battlefield state...</div>}
        <div ref={chatEnd} />
      </div>

      <div className="p-2 border-t border-border flex gap-1.5">
        <input
          value={chatIn}
          onChange={e => setChatIn(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onSend()}
          placeholder="Ask about logistics, movement, supply..."
          className="flex-1 bg-white border border-border text-foreground px-2.5 py-1.5 font-mono text-xs rounded outline-none focus:border-primary/50 transition-colors"
        />
        <button
          onClick={onSend}
          disabled={chatLoad}
          className="px-3.5 py-1.5 bg-primary border-none text-primary-foreground cursor-pointer font-mono text-[11px] font-semibold rounded disabled:opacity-40 disabled:cursor-wait"
        >
          Send
        </button>
      </div>
    </div>
  );
}

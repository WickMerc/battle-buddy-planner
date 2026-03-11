import { useRef, useEffect, useMemo } from "react";
import type { ChatMessage } from "@/lib/taclog-data";

const STARTER_CHIPS = [
  "What are my total fuel requirements?",
  "Can I sustain operations for 48 hours?",
  "What's the movement cost between locations?",
  "Generate a supply timeline",
];

interface ChatPanelProps {
  chat: ChatMessage[];
  chatIn: string;
  setChatIn: (v: string) => void;
  chatLoad: boolean;
  onSend: (msg?: string) => void;
  onFlyToLocation?: (name: string) => void;
  locationNames?: string[];
}

export default function ChatPanel({ chat, chatIn, setChatIn, chatLoad, onSend, onFlyToLocation, locationNames = [] }: ChatPanelProps) {
  const chatEnd = useRef<HTMLDivElement>(null);
  const showStarters = chat.length <= 1 && !chatLoad;

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const handleChipClick = (text: string) => {
    setChatIn(text);
    onSend(text);
  };

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
              <LocationLinkedText
                text={m.text}
                locationNames={locationNames}
                onFlyTo={onFlyToLocation}
              />
            </div>
          </div>
        ))}
        {chatLoad && <div className="text-primary text-[11px] italic">Analyzing battlefield state...</div>}

        {/* Starter chips */}
        {showStarters && (
          <div className="mt-3 space-y-1.5">
            <div className="text-[9px] text-muted-foreground uppercase tracking-[1px] mb-1">Suggested questions</div>
            {STARTER_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                className="block w-full text-left px-2.5 py-1.5 rounded bg-secondary text-secondary-foreground text-[11px] border border-border cursor-pointer hover:border-primary/40 transition-colors duration-150"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
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
          onClick={() => onSend()}
          disabled={chatLoad}
          className="px-3.5 py-1.5 bg-primary border-none text-primary-foreground cursor-pointer font-mono text-[11px] font-semibold rounded disabled:opacity-40 disabled:cursor-wait"
        >
          Send
        </button>
      </div>
    </div>
  );
}

/** Renders text with clickable location names */
function LocationLinkedText({
  text,
  locationNames,
  onFlyTo,
}: {
  text: string;
  locationNames: string[];
  onFlyTo?: (name: string) => void;
}) {
  const parts = useMemo(() => {
    if (!locationNames.length || !onFlyTo) return [{ type: "text" as const, value: text }];
    // Sort by length descending so longer names match first
    const sorted = [...locationNames].sort((a, b) => b.length - a.length);
    const escaped = sorted.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`(${escaped.join("|")})`, "gi");
    const result: { type: "text" | "link"; value: string }[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        result.push({ type: "text", value: text.slice(lastIdx, match.index) });
      }
      result.push({ type: "link", value: match[1] });
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < text.length) {
      result.push({ type: "text", value: text.slice(lastIdx) });
    }
    return result;
  }, [text, locationNames, onFlyTo]);

  return (
    <>
      {parts.map((p, i) =>
        p.type === "link" ? (
          <span
            key={i}
            onClick={() => onFlyTo?.(p.value)}
            className="text-primary cursor-pointer underline decoration-primary/30 hover:decoration-primary transition-colors"
          >
            {p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </>
  );
}

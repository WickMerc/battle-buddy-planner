import type { LogisticsResult } from "@/lib/taclog-data";

interface LogisticsPanelProps {
  log: LogisticsResult;
  hours: number;
  onSelectNode: (nodeId: string) => void;
}

export default function LogisticsPanel({ log, hours, onSelectNode }: LogisticsPanelProps) {
  if (log.fuel === 0) {
    return (
      <div className="flex-1 overflow-auto p-2.5">
        <div className="text-muted-foreground p-5 text-center text-[11px] leading-[1.8]">
          <div className="text-[30px] opacity-30 mb-2">⬡</div>
          Click a location and add<br />equipment to see logistics<br />calculations update live
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-2.5">
      <div className="bg-white border border-border rounded-md p-3 mb-2.5">
        <div className="text-muted-foreground text-[9px] uppercase tracking-[2px] mb-2 font-semibold">{hours}hr Mission Totals</div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <div className="text-muted-foreground text-[9px]">Fuel Required</div>
            <div className="text-tac-amber font-bold text-lg">{log.fuel.toLocaleString()}</div>
            <div className="text-muted-foreground text-[9px]">gallons</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[9px]">HEMTT Loads</div>
            <div className="text-tac-purple font-bold text-lg">{log.hemtt}</div>
            <div className="text-muted-foreground text-[9px]">sorties</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[9px]">Personnel</div>
            <div className="text-tac-blue font-bold text-lg">{log.crew}</div>
            <div className="text-muted-foreground text-[9px]">total crew</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[9px]">Active Sites</div>
            <div className="text-primary font-bold text-lg">{log.nodes.filter(n => n.fuel > 0).length}</div>
            <div className="text-muted-foreground text-[9px]">locations</div>
          </div>
        </div>
      </div>

      {log.nodes.filter(n => n.fuel > 0).map(nr => (
        <div
          key={nr.id}
          className="border border-border rounded-[5px] mb-1.5 p-2 bg-white cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => onSelectNode(nr.id)}
        >
          <div className="flex justify-between mb-1">
            <span className="text-primary font-bold text-xs">{nr.name}</span>
            <span className="text-tac-amber font-bold">{nr.fuel.toLocaleString()}g</span>
          </div>
          {nr.items.map((eq, i) => (
            <div
              key={i}
              className="flex justify-between py-0.5 text-[10px] text-secondary-foreground"
              style={{ borderTop: i > 0 ? '1px solid hsl(var(--secondary))' : 'none' }}
            >
              <span>{eq.count}× {eq.name}</span>
              <span>
                <span style={{ color: eq.pct < 30 ? 'hsl(var(--tac-red))' : 'hsl(var(--primary))' }}>
                  {eq.pct}%
                </span>
                {' '}→ <span className="text-tac-amber">{eq.tot.toLocaleString()}g</span>
              </span>
            </div>
          ))}
          <div className="text-muted-foreground text-[9px] mt-1 text-right">
            {nr.hemtt} HEMTT · {nr.crew} crew{nr.items.length > 0 ? ` · ${nr.items.map(i => i.endur + "h endur").join(", ")}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

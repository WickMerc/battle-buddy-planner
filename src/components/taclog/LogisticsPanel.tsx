import type { LogisticsResult } from "@/lib/taclog-data";

interface LogisticsPanelProps {
  log: LogisticsResult;
  hours: number;
  onSelectNode: (nodeId: string) => void;
}

export default function LogisticsPanel({ log, hours, onSelectNode }: LogisticsPanelProps) {
  if (log.totalFuel === 0) {
    return (
      <div className="flex-1 overflow-auto p-2.5">
        <div className="text-muted-foreground p-4 text-center text-[11px] leading-[1.8]">
          <div className="text-[28px] opacity-20 mb-2">⬡</div>
          Click a location on the map<br />and add equipment to see<br />logistics calculations
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-2.5">
      <div className="bg-secondary border border-border p-2.5 mb-2">
        <div className="text-muted-foreground text-[8px] uppercase tracking-[2px] mb-2">{hours}hr Totals</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-muted-foreground text-[8px]">Fuel Required</div>
            <div className="text-tac-amber font-bold text-base">{log.totalFuel.toLocaleString()}</div>
            <div className="text-muted-foreground text-[8px]">gallons</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[8px]">HEMTT Loads</div>
            <div className="text-tac-purple font-bold text-base">{log.totalHemtt}</div>
            <div className="text-muted-foreground text-[8px]">sorties</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[8px]">Personnel</div>
            <div className="text-tac-blue font-bold text-base">{log.totalCrew}</div>
            <div className="text-muted-foreground text-[8px]">total crew</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[8px]">Active Sites</div>
            <div className="text-primary font-bold text-base">{log.nodes.filter(n => n.totalFuel > 0).length}</div>
            <div className="text-muted-foreground text-[8px]">locations</div>
          </div>
        </div>
      </div>

      {log.nodes.filter(n => n.totalFuel > 0).map(nr => (
        <div
          key={nr.nodeId}
          className="border border-border mb-1.5 p-2 bg-card cursor-pointer hover:border-primary/30 transition-colors"
          onClick={() => onSelectNode(nr.nodeId)}
        >
          <div className="flex justify-between mb-1">
            <span className="text-primary font-semibold text-[11px]">{nr.nodeName}</span>
            <span className="text-tac-amber font-semibold">{nr.totalFuel.toLocaleString()}g</span>
          </div>
          {nr.items.map((eq, i) => (
            <div
              key={i}
              className="flex justify-between py-px text-[9px] text-secondary-foreground"
              style={{ borderTop: i > 0 ? '1px solid hsl(var(--muted))' : 'none' }}
            >
              <span>{eq.count}× {eq.name}</span>
              <span>
                <span style={{ color: eq.pct < 30 ? 'hsl(var(--tac-red))' : 'hsl(var(--tac-green) / 0.6)' }}>
                  {eq.pct}%
                </span>
                {' '}→ {eq.total.toLocaleString()}g
              </span>
            </div>
          ))}
          <div className="text-muted-foreground text-[8px] mt-1 text-right">{nr.hemtt} HEMTT · {nr.totalCrew} crew</div>
        </div>
      ))}
    </div>
  );
}

import type { LogisticsResult } from "@/lib/taclog-data";

interface LogisticsPanelProps {
  log: LogisticsResult;
  hours: number;
  onSelectNode: (nodeId: string) => void;
  onFlyTo?: (nodeId: string) => void;
}

function FuelGauge({ pct }: { pct: number }) {
  const color = pct >= 50 ? 'hsl(var(--primary))' : pct >= 25 ? 'hsl(var(--tac-amber))' : 'hsl(var(--destructive))';
  return (
    <div className="w-full h-[3px] bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.max(2, pct)}%`, background: color }}
      />
    </div>
  );
}

export default function LogisticsPanel({ log, hours, onSelectNode, onFlyTo }: LogisticsPanelProps) {
  const handleClick = (id: string) => {
    onSelectNode(id);
    // Fly to location on the map
    if ((window as any).__taclogFlyTo) {
      const node = log.nodes.find(n => n.id === id);
      // We don't have lng/lat here, so we trigger via onFlyTo or the window function
    }
    onFlyTo?.(id);
  };

  if (log.fuel === 0) {
    return (
      <div className="flex-1 overflow-auto p-3">
        <div className="text-muted-foreground p-5 text-center text-[10px] leading-[1.8]">
          <div className="text-[28px] opacity-20 mb-2">⬡</div>
          Click a location and add<br />equipment to see logistics<br />calculations update live
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-2.5">
      {/* Summary */}
      <div className="bg-background rounded-md p-3 mb-2.5 card-shadow">
        <div className="text-muted-foreground text-[8px] uppercase tracking-[2px] mb-2 font-medium">{hours}hr Mission Totals</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-muted-foreground text-[8px]">Fuel Required</div>
            <div className="text-tac-amber font-medium text-lg leading-tight">{log.fuel.toLocaleString()}</div>
            <div className="text-muted-foreground text-[8px]">gallons</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[8px]">HEMTT Loads</div>
            <div className="text-tac-purple font-medium text-lg leading-tight">{log.hemtt}</div>
            <div className="text-muted-foreground text-[8px]">sorties</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[8px]">Personnel</div>
            <div className="text-tac-blue font-medium text-lg leading-tight">{log.crew}</div>
            <div className="text-muted-foreground text-[8px]">total crew</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[8px]">Active Sites</div>
            <div className="text-primary font-medium text-lg leading-tight">{log.nodes.filter(n => n.fuel > 0).length}</div>
            <div className="text-muted-foreground text-[8px]">locations</div>
          </div>
        </div>
      </div>

      {/* Location rows */}
      {log.nodes.filter(n => n.fuel > 0).map(nr => (
        <div
          key={nr.id}
          className="rounded-md mb-1.5 p-2 bg-background cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all duration-200 card-shadow"
          onClick={() => handleClick(nr.id)}
        >
          <div className="flex justify-between mb-1.5">
            <span className="text-primary font-medium text-[11px]">{nr.name}</span>
            <span className="text-tac-amber font-medium text-[11px]">{nr.fuel.toLocaleString()}g</span>
          </div>
          {nr.items.map((eq, i) => (
            <div key={i} className="py-1" style={{ borderTop: i > 0 ? '1px solid hsl(var(--border) / 0.5)' : 'none' }}>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-secondary-foreground">{eq.count}× {eq.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-tac-amber text-[9px]">{eq.tot.toLocaleString()}g</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1">
                  <FuelGauge pct={eq.pct} />
                </div>
                <span
                  className="text-[9px] font-medium min-w-[28px] text-right"
                  style={{ color: eq.pct < 25 ? 'hsl(var(--destructive))' : eq.pct < 50 ? 'hsl(var(--tac-amber))' : 'hsl(var(--primary))' }}
                >
                  {eq.pct}%
                </span>
                <span className="text-muted-foreground text-[8px] min-w-[42px] text-right font-medium" title="Hours of endurance remaining">
                  {eq.endur}h endur
                </span>
              </div>
            </div>
          ))}
          <div className="text-muted-foreground text-[8px] mt-1 text-right">
            {nr.hemtt} HEMTT · {nr.crew} crew
          </div>
        </div>
      ))}
    </div>
  );
}

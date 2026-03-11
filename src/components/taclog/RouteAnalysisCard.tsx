import type { RouteAnalysis } from "@/lib/route-analysis";

interface RouteAnalysisCardProps {
  analysis: RouteAnalysis;
  onClose: () => void;
}

export default function RouteAnalysisCard({ analysis, onClose }: RouteAnalysisCardProps) {
  const { from, to, distMi, distKm, vehicles, totalConvoyFuel, totalAvailableFuel, feasible, deficit, slowestConvoyTime } = analysis;

  return (
    <div className="bg-card border border-border rounded-md p-3.5 w-[400px] max-h-[70vh] overflow-auto text-xs shadow-xl font-mono">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-[9px] uppercase tracking-[2px] text-muted-foreground font-semibold">Route Analysis</div>
          <div className="text-primary font-bold text-[14px] mt-0.5">
            {from.name} → {to.name}
          </div>
        </div>
        <button onClick={onClose} className="bg-secondary border border-border text-secondary-foreground cursor-pointer px-2.5 py-1 rounded font-mono text-[13px]">✕</button>
      </div>

      {/* Distance summary */}
      <div className="flex gap-3 mb-3 bg-secondary/50 rounded p-2">
        <div>
          <div className="text-muted-foreground text-[9px]">DISTANCE</div>
          <div className="text-foreground font-bold text-[13px]">{distMi.toFixed(1)} mi</div>
          <div className="text-muted-foreground text-[10px]">{distKm.toFixed(1)} km</div>
        </div>
        <div className="w-px bg-border" />
        <div>
          <div className="text-muted-foreground text-[9px]">CONVOY TIME</div>
          <div className="text-foreground font-bold text-[13px]">{slowestConvoyTime}</div>
          <div className="text-muted-foreground text-[10px]">@ 60% max speed</div>
        </div>
        <div className="w-px bg-border" />
        <div>
          <div className="text-muted-foreground text-[9px]">CONVOY FUEL</div>
          <div className="text-foreground font-bold text-[13px]">{totalConvoyFuel.toLocaleString()} gal</div>
          <div className="text-muted-foreground text-[10px]">one-way total</div>
        </div>
      </div>

      {/* Feasibility banner */}
      <div
        className="rounded p-2 mb-3 text-[11px] font-semibold border"
        style={{
          background: feasible ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--destructive) / 0.1)',
          borderColor: feasible ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--destructive) / 0.3)',
          color: feasible ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
        }}
      >
        {feasible
          ? "✓ Movement feasible — sufficient fuel on hand"
          : `⚠ Requires refuel before movement — deficit of ${deficit.toLocaleString()} gallons`}
      </div>

      {/* Vehicle breakdown */}
      {vehicles.length === 0 ? (
        <div className="text-center text-muted-foreground text-[10px] py-3 border border-dashed border-border rounded">
          No equipment at {from.name}
        </div>
      ) : (
        <div>
          <div className="text-[9px] uppercase tracking-[2px] text-muted-foreground font-semibold mb-1.5 border-b border-border pb-1">
            Vehicle Breakdown
          </div>
          <div className="flex flex-col gap-1">
            {vehicles.map((v, i) => (
              <div
                key={i}
                className="rounded p-2 border"
                style={{
                  background: !v.canMakeTrip ? 'hsl(var(--destructive) / 0.05)' : 'hsl(var(--secondary) / 0.3)',
                  borderColor: !v.canMakeTrip ? 'hsl(var(--destructive) / 0.2)' : 'hsl(var(--border))',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-[11px] font-semibold">
                    {v.count}× {v.name}
                  </span>
                  {!v.canMakeTrip && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'hsl(var(--destructive) / 0.15)', color: 'hsl(var(--destructive))' }}>
                      NEED {v.deficit.toLocaleString()}g
                    </span>
                  )}
                </div>
                <div className="flex gap-3 mt-1 text-[9px] text-muted-foreground">
                  {v.speed > 0 ? (
                    <>
                      <span>Max: {v.travelTimeMax} @ {v.speed}mph</span>
                      <span>Convoy: {v.travelTimeConvoy} @ {v.convoySpeed}mph</span>
                    </>
                  ) : (
                    <span>Towed — requires prime mover</span>
                  )}
                </div>
                {v.speed > 0 && (
                  <div className="flex gap-3 mt-0.5 text-[9px]">
                    <span className="text-muted-foreground">
                      Fuel: <span className="text-foreground font-medium">{v.fuelOneWay.toLocaleString()}g</span> one-way · <span className="text-foreground font-medium">{v.fuelRoundTrip.toLocaleString()}g</span> RT
                    </span>
                    <span className="text-muted-foreground">
                      Have: <span style={{ color: v.canMakeTrip ? 'hsl(var(--primary))' : 'hsl(var(--destructive))', fontWeight: 600 }}>
                        {v.currentFuel.toLocaleString()}g
                      </span>/{v.maxFuel.toLocaleString()}g
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

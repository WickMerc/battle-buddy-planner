import { useRef } from "react";
import type { BriefingData } from "@/lib/briefing-types";
import html2canvas from "html2canvas";

interface BriefingOverlayProps {
  briefing: BriefingData;
  onClose: () => void;
}

const statusColor = (s: "green" | "amber" | "red") => {
  if (s === "green") return { bg: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", border: "hsl(var(--primary) / 0.3)" };
  if (s === "amber") return { bg: "hsl(30 80% 50% / 0.12)", color: "hsl(30 80% 45%)", border: "hsl(30 80% 50% / 0.3)" };
  return { bg: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))", border: "hsl(var(--destructive) / 0.3)" };
};

const severityColor = (s: string) => {
  if (s === "critical") return "hsl(var(--destructive))";
  if (s === "high") return "hsl(0 60% 50%)";
  if (s === "medium") return "hsl(30 80% 45%)";
  return "hsl(var(--primary))";
};

const severityBg = (s: string) => {
  if (s === "critical") return "hsl(var(--destructive) / 0.12)";
  if (s === "high") return "hsl(0 60% 50% / 0.1)";
  if (s === "medium") return "hsl(30 80% 45% / 0.1)";
  return "hsl(var(--primary) / 0.1)";
};

function buildTextVersion(b: BriefingData): string {
  let t = `LOGISTICS ESTIMATE — ${b.generatedAt}\n${"=".repeat(50)}\n\n`;
  t += `MISSION SUMMARY\n${b.missionSummary}\n\n`;
  t += `FORCE COMPOSITION\nTotal Vehicles: ${b.forceComposition.totalVehicles} | Personnel: ${b.forceComposition.totalPersonnel}\n`;
  b.forceComposition.byCategory.forEach(c => { t += `  ${c.category}: ${c.count} (${c.types})\n`; });
  t += `\nSUPPLY REQUIREMENTS\n`;
  t += `  Class III (Fuel): ${b.supplyRequirements.classIII.totalGallons.toLocaleString()} gal, ${b.supplyRequirements.classIII.hemttLoads} HEMTT loads\n`;
  t += `    Schedule: ${b.supplyRequirements.classIII.resupplySchedule}\n`;
  t += `  Class I (Rations): ${b.supplyRequirements.classI.totalMeals} meals for ${b.supplyRequirements.classI.personnelCount} personnel\n`;
  t += `    ${b.supplyRequirements.classI.mealBreakdown}\n`;
  t += `  Class V (Ammo): ${b.supplyRequirements.classV.assessment}\n`;
  b.supplyRequirements.classV.details.forEach(d => { t += `    ${d.platform}: ${d.basicLoad}\n`; });
  if (b.criticalRisks.length) {
    t += `\nCRITICAL RISKS\n`;
    b.criticalRisks.forEach(r => { t += `  [${r.severity.toUpperCase()}] ${r.risk}\n    Mitigation: ${r.mitigation}\n`; });
  }
  if (b.movementAnalysis.length) {
    t += `\nMOVEMENT ANALYSIS\n`;
    b.movementAnalysis.forEach(m => { t += `  ${m.route}: ${m.distance}, ${m.estimatedTime}, fuel: ${m.fuelCost}\n`; });
  }
  t += `\nRECOMMENDATION\n${b.recommendation}\n`;
  return t;
}

export default function BriefingOverlay({ briefing, onClose }: BriefingOverlayProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const b = briefing;

  const copyToClipboard = async () => {
    const text = buildTextVersion(b);
    await navigator.clipboard.writeText(text);
  };

  const downloadPdf = async () => {
    if (!contentRef.current) return;
    const canvas = await html2canvas(contentRef.current, {
      backgroundColor: "#f0ebe2",
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `TACLOG_Briefing_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm" onClick={onClose} />

      {/* Content */}
      <div className="relative w-[90vw] max-w-[900px] max-h-[92vh] flex flex-col bg-card rounded-lg shadow-2xl overflow-hidden border border-border animate-scale-in">
        {/* Dark header */}
        <div className="bg-foreground px-5 py-3 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[9px] uppercase tracking-[3px] text-muted-foreground/70 font-semibold">Logistics Estimate</div>
            <div className="text-primary-foreground font-bold text-[14px] font-mono tracking-wide">
              TACLOG BRIEFING — {b.generatedAt}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={copyToClipboard} className="px-3 py-1.5 bg-primary/20 border border-primary/40 text-primary rounded text-[10px] font-mono font-semibold cursor-pointer hover:bg-primary/30 transition-colors">
              ⧉ Copy Text
            </button>
            <button onClick={downloadPdf} className="px-3 py-1.5 bg-primary/20 border border-primary/40 text-primary rounded text-[10px] font-mono font-semibold cursor-pointer hover:bg-primary/30 transition-colors">
              ↓ Download Image
            </button>
            <button onClick={onClose} className="px-3 py-1.5 bg-secondary/20 border border-secondary/40 text-primary-foreground rounded text-[10px] font-mono cursor-pointer hover:bg-secondary/30 transition-colors">
              ✕ Close
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div ref={contentRef} className="flex-1 overflow-auto p-5 space-y-5 text-xs font-mono bg-card">
          {/* Mission Summary */}
          <Section title="1. Mission Summary">
            <p className="text-foreground text-[12px] leading-relaxed">{b.missionSummary}</p>
          </Section>

          {/* Force Composition */}
          <Section title="2. Force Composition">
            <div className="flex gap-4 mb-3">
              <BigStat label="Total Vehicles" value={b.forceComposition.totalVehicles} color="hsl(var(--primary))" />
              <BigStat label="Total Personnel" value={b.forceComposition.totalPersonnel} color="hsl(var(--tac-blue))" />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {b.forceComposition.byCategory.map((c, i) => (
                <div key={i} className="bg-secondary/40 border border-border rounded p-2">
                  <div className="text-foreground font-semibold text-[11px]">{c.category} — {c.count}</div>
                  <div className="text-muted-foreground text-[9px] mt-0.5">{c.types}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Supply Requirements */}
          <Section title="3. Supply Requirements">
            <div className="grid grid-cols-3 gap-3">
              {/* Class III */}
              <SupplyCard
                title="Class III — Fuel"
                status={b.supplyRequirements.classIII.status}
                mainValue={`${b.supplyRequirements.classIII.totalGallons.toLocaleString()}`}
                mainUnit="gallons"
              >
                <div className="text-muted-foreground text-[9px] mt-1.5 space-y-0.5">
                  <div><span className="text-foreground font-semibold">{b.supplyRequirements.classIII.hemttLoads}</span> HEMTT tanker loads</div>
                  <div>{b.supplyRequirements.classIII.resupplySchedule}</div>
                </div>
              </SupplyCard>

              {/* Class I */}
              <SupplyCard
                title="Class I — Rations"
                status={b.supplyRequirements.classI.status}
                mainValue={`${b.supplyRequirements.classI.totalMeals.toLocaleString()}`}
                mainUnit="meals"
              >
                <div className="text-muted-foreground text-[9px] mt-1.5 space-y-0.5">
                  <div><span className="text-foreground font-semibold">{b.supplyRequirements.classI.personnelCount}</span> personnel</div>
                  <div>{b.supplyRequirements.classI.mealBreakdown}</div>
                </div>
              </SupplyCard>

              {/* Class V */}
              <SupplyCard
                title="Class V — Ammo"
                status={b.supplyRequirements.classV.status}
                mainValue=""
                mainUnit=""
              >
                <div className="text-muted-foreground text-[9px] mt-1 space-y-0.5">
                  <div className="text-foreground text-[10px] font-medium">{b.supplyRequirements.classV.assessment}</div>
                  {b.supplyRequirements.classV.details.map((d, i) => (
                    <div key={i}><span className="text-foreground font-semibold">{d.platform}:</span> {d.basicLoad}</div>
                  ))}
                </div>
              </SupplyCard>
            </div>
          </Section>

          {/* Critical Risks */}
          {b.criticalRisks.length > 0 && (
            <Section title="4. Critical Risks">
              <div className="space-y-1.5">
                {b.criticalRisks.map((r, i) => (
                  <div key={i} className="flex gap-2 items-start rounded p-2 border" style={{ background: severityBg(r.severity), borderColor: `${severityColor(r.severity)}33` }}>
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase" style={{ background: severityColor(r.severity), color: "white" }}>
                      {r.severity}
                    </span>
                    <div className="flex-1">
                      <div className="text-foreground text-[11px] font-medium">{r.risk}</div>
                      <div className="text-muted-foreground text-[9px] mt-0.5">Mitigation: {r.mitigation}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Movement Analysis */}
          {b.movementAnalysis.length > 0 && (
            <Section title="5. Movement Analysis">
              <div className="space-y-1">
                {b.movementAnalysis.map((m, i) => (
                  <div key={i} className="bg-secondary/30 border border-border rounded p-2 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-foreground text-[11px] font-semibold">{m.route}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-foreground text-[11px] font-bold">{m.distance}</div>
                      <div className="text-muted-foreground text-[8px]">distance</div>
                    </div>
                    <div className="text-center">
                      <div className="text-foreground text-[11px] font-bold">{m.estimatedTime}</div>
                      <div className="text-muted-foreground text-[8px]">travel time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-foreground text-[11px] font-bold">{m.fuelCost}</div>
                      <div className="text-muted-foreground text-[8px]">fuel cost</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Recommendation */}
          <Section title="6. Recommendation">
            <div className="bg-primary/8 border border-primary/20 rounded p-3">
              <p className="text-foreground text-[12px] leading-relaxed font-medium">{b.recommendation}</p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[2px] text-muted-foreground font-bold border-b border-border pb-1 mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function BigStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-secondary/40 border border-border rounded px-4 py-2 text-center">
      <div className="text-[22px] font-extrabold font-mono" style={{ color }}>{value.toLocaleString()}</div>
      <div className="text-muted-foreground text-[9px] uppercase tracking-wider">{label}</div>
    </div>
  );
}

function SupplyCard({
  title, status, mainValue, mainUnit, children,
}: {
  title: string;
  status: "green" | "amber" | "red";
  mainValue: string;
  mainUnit: string;
  children: React.ReactNode;
}) {
  const sc = statusColor(status);
  return (
    <div className="rounded p-2.5 border" style={{ background: sc.bg, borderColor: sc.border }}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[9px] uppercase tracking-wider font-bold" style={{ color: sc.color }}>{title}</div>
        <span className="text-[7px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: sc.color, color: "white" }}>
          {status}
        </span>
      </div>
      {mainValue && (
        <div>
          <span className="text-[20px] font-extrabold" style={{ color: sc.color }}>{mainValue}</span>
          <span className="text-[10px] ml-1" style={{ color: sc.color }}>{mainUnit}</span>
        </div>
      )}
      {children}
    </div>
  );
}

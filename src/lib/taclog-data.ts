export interface EquipmentType {
  name: string;
  cat: string;
  fuelBurn: number;
  fuelCap: number;
  speed: number;
  crew: number;
  cargo?: number;
  fuelHaul?: number;
}

export interface EquipmentEntry {
  tid: string;
  count: number;
  fuelPct: number;
}

export interface ShapeData {
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface MapNode {
  id: string;
  x: number;
  y: number;
  name: string;
  shape: "point" | "circle" | "rect";
  shapeData?: ShapeData;
  equipment: EquipmentEntry[];
}

export interface LogItem {
  tid: string;
  name: string;
  count: number;
  pct: number;
  ops: number;
  top: number;
  tot: number;
  crew: number;
  endur: string;
  hemtt: number;
}

export interface NodeLogistics {
  id: string;
  name: string;
  items: LogItem[];
  fuel: number;
  crew: number;
  hemtt: number;
}

export interface LogisticsResult {
  nodes: NodeLogistics[];
  fuel: number;
  crew: number;
  hemtt: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  text: string;
}

export type EquipmentDB = Record<string, EquipmentType>;

export const DEFAULT_EQUIPMENT: EquipmentDB = {
  uh60: { name: "UH-60 Black Hawk", cat: "Rotary Wing", fuelBurn: 130, fuelCap: 360, speed: 150, crew: 4 },
  ch47: { name: "CH-47 Chinook", cat: "Rotary Wing", fuelBurn: 200, fuelCap: 1030, speed: 170, crew: 5 },
  ah64: { name: "AH-64 Apache", cat: "Rotary Wing", fuelBurn: 165, fuelCap: 375, speed: 182, crew: 2 },
  m1: { name: "M1A2 Abrams", cat: "Armor", fuelBurn: 60, fuelCap: 500, speed: 42, crew: 4 },
  m2: { name: "M2A3 Bradley", cat: "IFV", fuelBurn: 30, fuelCap: 175, speed: 40, crew: 3 },
  stryker: { name: "Stryker ICV", cat: "IFV", fuelBurn: 12, fuelCap: 53, speed: 62, crew: 2 },
  hmmwv: { name: "HMMWV", cat: "Wheeled", fuelBurn: 4, fuelCap: 25, speed: 55, crew: 4 },
  fmtv: { name: "FMTV (M1078)", cat: "Logistics", fuelBurn: 8, fuelCap: 55, speed: 55, crew: 2 },
  hemtt: { name: "HEMTT Tanker", cat: "Logistics", fuelBurn: 12, fuelCap: 80, speed: 56, crew: 2 },
  paladin: { name: "M109A7 Paladin", cat: "Artillery", fuelBurn: 40, fuelCap: 133, speed: 38, crew: 6 },
};

export function gid(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function px2mi(px: number): number {
  return px * 0.12;
}

export function bounds(pts: { x: number; y: number }[]) {
  let mx = Infinity, my = Infinity, Mx = -Infinity, My = -Infinity;
  pts.forEach(p => { mx = Math.min(mx, p.x); my = Math.min(my, p.y); Mx = Math.max(Mx, p.x); My = Math.max(My, p.y); });
  return { minX: mx, minY: my, maxX: Mx, maxY: My, cx: (mx + Mx) / 2, cy: (my + My) / 2, w: Mx - mx, h: My - my };
}

export function classifyShape(pts: { x: number; y: number }[]): "dot" | "line" | "circle" | "rect" {
  if (pts.length < 8) return "dot";
  const b = bounds(pts);
  if (b.w < 15 && b.h < 15) return "dot";
  const first = pts[0], last = pts[pts.length - 1];
  const closed = dist(first, last) < Math.max(b.w, b.h) * 0.4;
  if (!closed) return "line";
  const perimeter = pts.reduce((s, p, i) => i === 0 ? 0 : s + dist(pts[i - 1], p), 0);
  const rx = b.w / 2, ry = b.h / 2;
  const ellipsePerim = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const rectPerim = 2 * (b.w + b.h);
  const aspect = Math.min(b.w, b.h) / Math.max(b.w, b.h);
  const circleScore = Math.abs(perimeter - ellipsePerim) / ellipsePerim;
  const rectScore = Math.abs(perimeter - rectPerim) / rectPerim;
  if (aspect > 0.7 && circleScore < 0.35) return "circle";
  if (rectScore < 0.35) return "rect";
  if (circleScore < rectScore) return "circle";
  return "rect";
}

export function computeLog(nodes: MapNode[], eqDb: EquipmentDB, hours: number): LogisticsResult {
  const res: NodeLogistics[] = [];
  let gF = 0, gC = 0;
  nodes.forEach(n => {
    const nr: NodeLogistics = { id: n.id, name: n.name, items: [], fuel: 0, crew: 0, hemtt: 0 };
    n.equipment.forEach(e => {
      const t = eqDb[e.tid];
      if (!t || e.count <= 0) return;
      const pct = e.fuelPct ?? 100;
      const cur = (pct / 100) * t.fuelCap;
      const ops = t.fuelBurn * hours * e.count;
      const top = Math.max(0, t.fuelCap * e.count - cur * e.count);
      const tot = ops + top;
      nr.items.push({
        tid: e.tid, name: t.name, count: e.count, pct,
        ops: Math.round(ops), top: Math.round(top), tot: Math.round(tot),
        crew: t.crew * e.count, endur: (cur / t.fuelBurn).toFixed(1),
        hemtt: Math.ceil(tot / 2500),
      });
      nr.fuel += tot;
      nr.crew += t.crew * e.count;
    });
    nr.fuel = Math.round(nr.fuel);
    nr.hemtt = Math.ceil(nr.fuel / 2500);
    gF += nr.fuel;
    gC += nr.crew;
    res.push(nr);
  });
  return { nodes: res, fuel: Math.round(gF), crew: gC, hemtt: Math.ceil(gF / 2500) };
}

export function buildCtx(nodes: MapNode[], eqDb: EquipmentDB, log: LogisticsResult, hours: number): string {
  let s = `BATTLEFIELD (${hours}hr):\n`;
  nodes.forEach(n => {
    s += `\n${n.name} [${n.shape || "point"}]:\n`;
    if (!n.equipment.length) { s += "  No equipment\n"; return; }
    n.equipment.forEach(e => {
      const t = eqDb[e.tid];
      if (t) s += `  ${e.count}x ${t.name} @ ${e.fuelPct ?? 100}% (${t.fuelBurn}g/hr, cap ${t.fuelCap}g, ${t.speed}mph)\n`;
    });
  });
  s += `\nTOTALS: ${log.fuel.toLocaleString()}gal, ${log.hemtt} HEMTT, ${log.crew} crew\n`;
  if (nodes.length > 1) {
    s += "\nDIST:\n";
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++)
        s += `${nodes[i].name}-${nodes[j].name}: ${px2mi(dist(nodes[i], nodes[j])).toFixed(1)}mi\n`;
  }
  return s;
}

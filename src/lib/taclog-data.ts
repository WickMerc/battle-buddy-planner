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
  // For geographic shapes
  center?: [number, number]; // [lng, lat]
  radiusKm?: number;
  bounds?: [[number, number], [number, number]]; // [[swLng, swLat], [neLng, neLat]]
  type?: "circle" | "rect";
}

export interface MapNode {
  id: string;
  lng: number;
  lat: number;
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

/** Haversine distance in miles between two geographic points */
export function haversineMi(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const aLat = a.lat * Math.PI / 180;
  const bLat = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Haversine distance in kilometers */
export function haversineKm(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  return haversineMi(a, b) * 1.60934;
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
    s += `\n${n.name} [${n.shape || "point"}] (${n.lat.toFixed(4)}, ${n.lng.toFixed(4)}):\n`;
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
      for (let j = i + 1; j < nodes.length; j++) {
        const mi = haversineMi(nodes[i], nodes[j]).toFixed(1);
        const km = haversineKm(nodes[i], nodes[j]).toFixed(1);
        s += `${nodes[i].name}-${nodes[j].name}: ${mi}mi / ${km}km\n`;
      }
  }
  return s;
}

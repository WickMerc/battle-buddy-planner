export interface EquipmentType {
  name: string;
  category: string;
  fuelBurn: number;
  fuelCap: number;
  speed: number;
  crew: number;
  cargo?: number;
  fuelHaul?: number;
}

export interface EquipmentEntry {
  typeId: string;
  count: number;
  startFuelPct: number;
}

export interface MapNode {
  id: string;
  x: number;
  y: number;
  name: string;
  equipment: EquipmentEntry[];
}

export interface LogItem {
  typeId: string;
  name: string;
  count: number;
  pct: number;
  opsFuel: number;
  topOff: number;
  total: number;
  crew: number;
  endurance: string;
  hemtt: number;
}

export interface NodeLogistics {
  nodeId: string;
  nodeName: string;
  items: LogItem[];
  totalFuel: number;
  totalCrew: number;
  hemtt: number;
}

export interface LogisticsResult {
  nodes: NodeLogistics[];
  totalFuel: number;
  totalCrew: number;
  totalHemtt: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  text: string;
}

export interface DrawStroke {
  id: string;
  points: { x: number; y: number }[];
}

export const EQUIPMENT_TYPES: Record<string, EquipmentType> = {
  uh60: { name: "UH-60 Black Hawk", category: "rotary", fuelBurn: 130, fuelCap: 360, speed: 150, crew: 4, cargo: 2640 },
  ch47: { name: "CH-47 Chinook", category: "rotary", fuelBurn: 200, fuelCap: 1030, speed: 170, crew: 5, cargo: 26000 },
  ah64: { name: "AH-64 Apache", category: "rotary", fuelBurn: 165, fuelCap: 375, speed: 182, crew: 2, cargo: 0 },
  m1: { name: "M1 Abrams", category: "armor", fuelBurn: 60, fuelCap: 500, speed: 42, crew: 4 },
  m2: { name: "M2 Bradley", category: "ifv", fuelBurn: 30, fuelCap: 175, speed: 40, crew: 3 },
  stryker: { name: "Stryker", category: "ifv", fuelBurn: 12, fuelCap: 53, speed: 62, crew: 2 },
  hmmwv: { name: "HMMWV", category: "wheeled", fuelBurn: 4, fuelCap: 25, speed: 55, crew: 4, cargo: 2500 },
  fmtv: { name: "FMTV Cargo", category: "logistics", fuelBurn: 8, fuelCap: 55, speed: 55, crew: 2, cargo: 10000 },
  hemtt: { name: "HEMTT Tanker", category: "logistics", fuelBurn: 12, fuelCap: 80, speed: 56, crew: 2, fuelHaul: 2500 },
  paladin: { name: "M109 Paladin", category: "artillery", fuelBurn: 40, fuelCap: 133, speed: 38, crew: 6 },
};

export const CAT_LABELS: Record<string, string> = {
  rotary: "Rotary Wing",
  armor: "Armor",
  ifv: "IFV",
  wheeled: "Wheeled",
  logistics: "Logistics",
  artillery: "Artillery",
};

export function gid(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function px2mi(px: number): number {
  return px * 0.15;
}

export function computeLogistics(nodes: MapNode[], hours: number): LogisticsResult {
  const res: NodeLogistics[] = [];
  let gFuel = 0, gCrew = 0;

  nodes.forEach(node => {
    const nr: NodeLogistics = { nodeId: node.id, nodeName: node.name, items: [], totalFuel: 0, totalCrew: 0, hemtt: 0 };

    node.equipment.forEach(eq => {
      const t = EQUIPMENT_TYPES[eq.typeId];
      if (!t || eq.count <= 0) return;

      const pct = eq.startFuelPct ?? 100;
      const curGal = (pct / 100) * t.fuelCap;
      const opsFuel = t.fuelBurn * hours * eq.count;
      const topOff = Math.max(0, t.fuelCap * eq.count - curGal * eq.count);
      const total = opsFuel + topOff;
      const crew = t.crew * eq.count;

      nr.items.push({
        typeId: eq.typeId,
        name: t.name,
        count: eq.count,
        pct,
        opsFuel: Math.round(opsFuel),
        topOff: Math.round(topOff),
        total: Math.round(total),
        crew,
        endurance: (curGal / t.fuelBurn).toFixed(1),
        hemtt: Math.ceil(total / 2500),
      });

      nr.totalFuel += total;
      nr.totalCrew += crew;
    });

    nr.totalFuel = Math.round(nr.totalFuel);
    nr.hemtt = Math.ceil(nr.totalFuel / 2500);
    gFuel += nr.totalFuel;
    gCrew += nr.totalCrew;
    res.push(nr);
  });

  return { nodes: res, totalFuel: Math.round(gFuel), totalCrew: gCrew, totalHemtt: Math.ceil(gFuel / 2500) };
}

export function buildCtx(nodes: MapNode[], log: LogisticsResult, hours: number): string {
  let s = `BATTLEFIELD (${hours}hr window):\n\n`;

  nodes.forEach(n => {
    s += `LOC: ${n.name}\n`;
    if (!n.equipment.length) { s += "  Empty\n"; return; }
    n.equipment.forEach(e => {
      const t = EQUIPMENT_TYPES[e.typeId];
      if (t) s += `  ${e.count}x ${t.name} @ ${e.startFuelPct ?? 100}% fuel (${t.fuelBurn}gal/hr, cap ${t.fuelCap}gal, ${t.speed}mph)\n`;
    });
  });

  s += `\nTOTALS: ${log.totalFuel.toLocaleString()}gal fuel, ${log.totalHemtt} HEMTT loads, ${log.totalCrew} crew\n`;

  if (nodes.length > 1) {
    s += "\nDISTANCES:\n";
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++)
        s += `${nodes[i].name} - ${nodes[j].name}: ${px2mi(dist(nodes[i], nodes[j])).toFixed(1)}mi\n`;
  }

  return s;
}

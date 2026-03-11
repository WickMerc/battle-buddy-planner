import { haversineMi, haversineKm, type MapNode, type EquipmentDB } from "@/lib/taclog-data";
import { EQUIPMENT_DB, type EquipmentType } from "@/lib/equipment-db";

export interface RouteVehicleAnalysis {
  name: string;
  count: number;
  speed: number;
  convoySpeed: number;
  travelTimeMax: string;
  travelTimeConvoy: string;
  fuelOneWay: number;
  fuelRoundTrip: number;
  currentFuel: number;
  maxFuel: number;
  canMakeTrip: boolean;
  deficit: number;
}

export interface RouteAnalysis {
  from: MapNode;
  to: MapNode;
  distMi: number;
  distKm: number;
  vehicles: RouteVehicleAnalysis[];
  totalConvoyFuel: number;
  totalAvailableFuel: number;
  feasible: boolean;
  deficit: number;
  slowestConvoyTime: string;
}

export function computeRouteAnalysis(
  from: MapNode,
  to: MapNode,
  eqDb: EquipmentDB
): RouteAnalysis {
  const distMi = haversineMi(from, to);
  const distKm = haversineKm(from, to);

  const vehicles: RouteVehicleAnalysis[] = [];
  let totalConvoyFuel = 0;
  let totalAvailableFuel = 0;
  let slowestHours = 0;

  from.equipment.forEach(e => {
    if (e.count <= 0) return;

    // Look up in new DB first, then legacy
    const dbEntry = EQUIPMENT_DB.find(eq => eq.id === e.tid);
    const legacyEntry = eqDb[e.tid];
    if (!dbEntry && !legacyEntry) return;

    const name = dbEntry?.name || legacyEntry?.name || e.tid;
    const speed = dbEntry?.speed || legacyEntry?.speed || 0;
    const fuelBurn = dbEntry?.fuelBurnMoving || legacyEntry?.fuelBurn || 0;
    const fuelCap = dbEntry?.fuelCap || legacyEntry?.fuelCap || 0;

    if (speed <= 0) {
      // Towed equipment (howitzers) — no self-propelled movement
      vehicles.push({
        name, count: e.count, speed: 0, convoySpeed: 0,
        travelTimeMax: "Towed", travelTimeConvoy: "Towed",
        fuelOneWay: 0, fuelRoundTrip: 0,
        currentFuel: 0, maxFuel: 0, canMakeTrip: true, deficit: 0,
      });
      return;
    }

    const convoySpeed = speed * 0.6;
    const travelHoursMax = distMi / speed;
    const travelHoursConvoy = distMi / convoySpeed;
    const fuelOneWay = fuelBurn * travelHoursConvoy * e.count;
    const fuelRoundTrip = fuelOneWay * 2;
    const currentFuel = (e.fuelPct / 100) * fuelCap * e.count;
    const maxFuel = fuelCap * e.count;
    const canMakeTrip = currentFuel >= fuelOneWay;
    const deficit = canMakeTrip ? 0 : fuelOneWay - currentFuel;

    if (travelHoursConvoy > slowestHours) slowestHours = travelHoursConvoy;

    totalConvoyFuel += fuelOneWay;
    totalAvailableFuel += currentFuel;

    vehicles.push({
      name, count: e.count, speed, convoySpeed: Math.round(convoySpeed),
      travelTimeMax: formatHours(travelHoursMax),
      travelTimeConvoy: formatHours(travelHoursConvoy),
      fuelOneWay: Math.round(fuelOneWay),
      fuelRoundTrip: Math.round(fuelRoundTrip),
      currentFuel: Math.round(currentFuel),
      maxFuel: Math.round(maxFuel),
      canMakeTrip, deficit: Math.round(deficit),
    });
  });

  const feasible = totalAvailableFuel >= totalConvoyFuel;
  const deficit = feasible ? 0 : Math.round(totalConvoyFuel - totalAvailableFuel);

  return {
    from, to, distMi, distKm, vehicles,
    totalConvoyFuel: Math.round(totalConvoyFuel),
    totalAvailableFuel: Math.round(totalAvailableFuel),
    feasible, deficit,
    slowestConvoyTime: formatHours(slowestHours),
  };
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}min`;
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export function buildRouteCtx(analysis: RouteAnalysis): string {
  let s = `\nROUTE ANALYSIS: ${analysis.from.name} → ${analysis.to.name}\n`;
  s += `Distance: ${analysis.distMi.toFixed(1)}mi / ${analysis.distKm.toFixed(1)}km\n`;
  s += `Convoy time (60% speed): ${analysis.slowestConvoyTime}\n`;
  if (analysis.vehicles.length > 0) {
    s += `Vehicles:\n`;
    analysis.vehicles.forEach(v => {
      s += `  ${v.count}x ${v.name}: convoy ${v.travelTimeConvoy}, fuel ${v.fuelOneWay}gal one-way (have ${v.currentFuel}gal)${!v.canMakeTrip ? ` ⚠ DEFICIT ${v.deficit}gal` : ''}\n`;
    });
  }
  s += `Total convoy fuel: ${analysis.totalConvoyFuel}gal (available: ${analysis.totalAvailableFuel}gal)\n`;
  s += analysis.feasible
    ? `Status: MOVEMENT FEASIBLE\n`
    : `Status: REQUIRES REFUEL — deficit ${analysis.deficit}gal\n`;
  return s;
}

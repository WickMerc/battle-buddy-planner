export interface EquipmentType {
  id: string;
  name: string;
  aliases: string[];
  cat: string;
  fuelBurnIdle: number;
  fuelBurnMoving: number;
  fuelCap: number;
  speed: number;
  crew: number;
  cargo?: number; // lbs
}

export const EQUIPMENT_DB: EquipmentType[] = [
  // Rotary Wing
  { id: "uh60a", name: "UH-60A/L Black Hawk", aliases: ["black hawk", "blackhawk", "uh60", "60a", "utility helicopter"], cat: "Rotary Wing", fuelBurnIdle: 40, fuelBurnMoving: 130, fuelCap: 360, speed: 150, crew: 4, cargo: 2640 },
  { id: "uh60m", name: "UH-60M Black Hawk", aliases: ["black hawk", "blackhawk", "mike model", "60m"], cat: "Rotary Wing", fuelBurnIdle: 42, fuelBurnMoving: 135, fuelCap: 360, speed: 152, crew: 4, cargo: 2640 },
  { id: "ch47d", name: "CH-47D Chinook", aliases: ["chinook", "shithook", "ch47", "heavy lift", "47d"], cat: "Rotary Wing", fuelBurnIdle: 60, fuelBurnMoving: 200, fuelCap: 1030, speed: 170, crew: 5, cargo: 26000 },
  { id: "ch47f", name: "CH-47F Chinook", aliases: ["chinook", "foxtrot chinook", "ch47f", "heavy lift"], cat: "Rotary Wing", fuelBurnIdle: 62, fuelBurnMoving: 210, fuelCap: 1030, speed: 175, crew: 5, cargo: 26000 },
  { id: "ah64d", name: "AH-64D Apache", aliases: ["apache", "attack helicopter", "ah64", "64d"], cat: "Rotary Wing", fuelBurnIdle: 50, fuelBurnMoving: 165, fuelCap: 375, speed: 182, crew: 2 },
  { id: "ah64e", name: "AH-64E Apache Guardian", aliases: ["apache guardian", "echo apache", "ah64e", "64e"], cat: "Rotary Wing", fuelBurnIdle: 52, fuelBurnMoving: 170, fuelCap: 375, speed: 186, crew: 2 },
  { id: "oh58d", name: "OH-58D Kiowa Warrior", aliases: ["kiowa", "oh58", "scout helicopter", "warrior"], cat: "Rotary Wing", fuelBurnIdle: 25, fuelBurnMoving: 65, fuelCap: 117, speed: 128, crew: 2 },
  { id: "mh47g", name: "MH-47G Chinook", aliases: ["special ops chinook", "mh47", "160th chinook", "night stalker"], cat: "Rotary Wing", fuelBurnIdle: 65, fuelBurnMoving: 220, fuelCap: 1030, speed: 175, crew: 5, cargo: 26000 },
  { id: "mh60m", name: "MH-60M Black Hawk", aliases: ["special ops black hawk", "mh60", "160th hawk", "night stalker hawk", "dap"], cat: "Rotary Wing", fuelBurnIdle: 44, fuelBurnMoving: 140, fuelCap: 360, speed: 152, crew: 4, cargo: 2640 },
  { id: "hh60m", name: "HH-60M MEDEVAC", aliases: ["medevac", "dustoff", "hh60", "medical hawk", "pedro"], cat: "Rotary Wing", fuelBurnIdle: 42, fuelBurnMoving: 135, fuelCap: 360, speed: 150, crew: 4 },

  // Armor
  { id: "m1a1", name: "M1A1 Abrams", aliases: ["abrams", "tank", "m1a1", "main battle tank", "mbt"], cat: "Armor", fuelBurnIdle: 17, fuelBurnMoving: 56, fuelCap: 500, speed: 42, crew: 4 },
  { id: "m1a2sep", name: "M1A2 SEP Abrams", aliases: ["abrams", "sep", "tank", "m1a2", "main battle tank", "mbt"], cat: "Armor", fuelBurnIdle: 18, fuelBurnMoving: 60, fuelCap: 500, speed: 42, crew: 4 },
  { id: "m1a2v3", name: "M1A2 SEPv3 Abrams", aliases: ["abrams", "sepv3", "tank", "v3", "main battle tank", "mbt"], cat: "Armor", fuelBurnIdle: 19, fuelBurnMoving: 62, fuelCap: 500, speed: 42, crew: 4 },

  // IFV / APC
  { id: "m2a3", name: "M2A3 Bradley IFV", aliases: ["bradley", "ifv", "m2", "brad", "infantry fighting vehicle"], cat: "IFV/APC", fuelBurnIdle: 8, fuelBurnMoving: 30, fuelCap: 175, speed: 40, crew: 3, cargo: 6000 },
  { id: "m3a3", name: "M3A3 Bradley CFV", aliases: ["bradley cavalry", "cfv", "m3", "cavalry fighting vehicle", "cav brad"], cat: "IFV/APC", fuelBurnIdle: 8, fuelBurnMoving: 30, fuelCap: 175, speed: 40, crew: 3 },
  { id: "stryker_icv", name: "Stryker ICV", aliases: ["stryker", "icv", "infantry carrier", "sbct"], cat: "IFV/APC", fuelBurnIdle: 4, fuelBurnMoving: 12, fuelCap: 53, speed: 62, crew: 2, cargo: 4000 },
  { id: "stryker_mgs", name: "Stryker MGS", aliases: ["stryker gun", "mgs", "mobile gun system"], cat: "IFV/APC", fuelBurnIdle: 4, fuelBurnMoving: 13, fuelCap: 53, speed: 60, crew: 3 },
  { id: "m113a3", name: "M113A3 APC", aliases: ["m113", "apc", "track", "one-thirteen", "113"], cat: "IFV/APC", fuelBurnIdle: 5, fuelBurnMoving: 15, fuelCap: 95, speed: 40, crew: 2, cargo: 4000 },

  // Wheeled
  { id: "hmmwv", name: "HMMWV (M1151)", aliases: ["humvee", "hummer", "m1151", "hmmwv", "up-armored"], cat: "Wheeled", fuelBurnIdle: 1, fuelBurnMoving: 4, fuelCap: 25, speed: 55, crew: 4, cargo: 2500 },
  { id: "jltv", name: "JLTV (M1280)", aliases: ["jltv", "m1280", "joint light tactical", "oshkosh"], cat: "Wheeled", fuelBurnIdle: 1.5, fuelBurnMoving: 5, fuelCap: 24, speed: 70, crew: 4, cargo: 3500 },
  { id: "lmtv", name: "LMTV (M1078)", aliases: ["lmtv", "m1078", "light medium tactical", "deuce"], cat: "Wheeled", fuelBurnIdle: 2, fuelBurnMoving: 6, fuelCap: 55, speed: 58, crew: 2, cargo: 5000 },
  { id: "mtv", name: "MTV (M1083)", aliases: ["mtv", "m1083", "medium tactical vehicle", "five-ton"], cat: "Wheeled", fuelBurnIdle: 2.5, fuelBurnMoving: 8, fuelCap: 55, speed: 55, crew: 2, cargo: 10000 },

  // Logistics
  { id: "fmtv_cargo", name: "FMTV Cargo (M1078A1)", aliases: ["fmtv", "cargo truck", "family medium tactical"], cat: "Logistics", fuelBurnIdle: 2, fuelBurnMoving: 8, fuelCap: 55, speed: 55, crew: 2, cargo: 5000 },
  { id: "hemtt_cargo", name: "HEMTT (M977)", aliases: ["hemtt", "m977", "heavy truck", "heavy expanded mobility"], cat: "Logistics", fuelBurnIdle: 3, fuelBurnMoving: 12, fuelCap: 80, speed: 56, crew: 2, cargo: 22000 },
  { id: "hemtt_tanker", name: "HEMTT Tanker (M978)", aliases: ["hemtt tanker", "m978", "fuel truck", "tanker"], cat: "Logistics", fuelBurnIdle: 3, fuelBurnMoving: 12, fuelCap: 80, speed: 56, crew: 2, cargo: 2500 },
  { id: "pls", name: "PLS (M1075)", aliases: ["pls", "m1075", "palletized load system", "palletized"], cat: "Logistics", fuelBurnIdle: 3.5, fuelBurnMoving: 14, fuelCap: 80, speed: 56, crew: 2, cargo: 33000 },
  { id: "hemat", name: "HEMAT", aliases: ["hemat", "heavy expanded mobility ammunition trailer"], cat: "Logistics", fuelBurnIdle: 0, fuelBurnMoving: 0, fuelCap: 0, speed: 56, crew: 0, cargo: 22000 },

  // Artillery
  { id: "m109a7", name: "M109A7 Paladin", aliases: ["paladin", "m109", "self-propelled howitzer", "sph", "109"], cat: "Artillery", fuelBurnIdle: 12, fuelBurnMoving: 40, fuelCap: 133, speed: 38, crew: 6 },
  { id: "himars", name: "M142 HIMARS", aliases: ["himars", "m142", "high mobility artillery rocket", "rocket launcher", "mlrs light"], cat: "Artillery", fuelBurnIdle: 2.5, fuelBurnMoving: 8, fuelCap: 55, speed: 55, crew: 3 },
  { id: "m119a3", name: "M119A3 Howitzer", aliases: ["m119", "light howitzer", "105mm", "towed howitzer"], cat: "Artillery", fuelBurnIdle: 0, fuelBurnMoving: 0, fuelCap: 0, speed: 0, crew: 7 },
  { id: "m777a2", name: "M777A2 Howitzer", aliases: ["m777", "triple seven", "155mm towed", "lightweight howitzer"], cat: "Artillery", fuelBurnIdle: 0, fuelBurnMoving: 0, fuelCap: 0, speed: 0, crew: 8 },

  // UAS
  { id: "mq1c", name: "MQ-1C Gray Eagle", aliases: ["gray eagle", "grey eagle", "mq1c", "uas", "drone", "armed uas"], cat: "UAS", fuelBurnIdle: 3, fuelBurnMoving: 8, fuelCap: 120, speed: 150, crew: 0 },
  { id: "rq7b", name: "RQ-7B Shadow", aliases: ["shadow", "rq7", "uas", "drone", "tactical uas", "tuav"], cat: "UAS", fuelBurnIdle: 1.5, fuelBurnMoving: 3, fuelCap: 16, speed: 110, crew: 0 },
];

/** Search equipment by query matching name, aliases, category, or id */
export function searchEquipment(query: string, db: EquipmentType[]): EquipmentType[] {
  const q = query.toLowerCase().trim();
  if (!q) return db;
  return db.filter(eq =>
    eq.name.toLowerCase().includes(q) ||
    eq.id.toLowerCase().includes(q) ||
    eq.cat.toLowerCase().includes(q) ||
    eq.aliases.some(a => a.includes(q))
  );
}

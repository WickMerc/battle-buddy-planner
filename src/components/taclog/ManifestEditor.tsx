import { useState, useRef, useEffect } from "react";
import type { MapNode, EquipmentDB } from "@/lib/taclog-data";
import { EQUIPMENT_DB, searchEquipment, type EquipmentType } from "@/lib/equipment-db";
import { forward as toMgrs } from "mgrs";
import { X } from "lucide-react";

interface ManifestEditorProps {
  node: MapNode;
  eqDb: EquipmentDB;
  onUpdate: (node: MapNode) => void;
  onClose: () => void;
  onRemove: () => void;
  onAddEquipType: (eq: { name: string; cat: string; fuelBurn: number; fuelCap: number; speed: number; crew: number }) => void;
  customEquipment?: EquipmentType[];
}

export default function ManifestEditor({ node, eqDb, onUpdate, onClose, onRemove, onAddEquipType, customEquipment = [] }: ManifestEditorProps) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newEq, setNewEq] = useState({ name: "", cat: "Wheeled", fuelBurnIdle: 2, fuelBurnMoving: 10, fuelCap: 50, speed: 50, crew: 2, cargo: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allEquipment = [...EQUIPMENT_DB, ...customEquipment];
  const results = query.trim() ? searchEquipment(query, allEquipment) : allEquipment;

  const grouped: Record<string, EquipmentType[]> = {};
  results.forEach(eq => {
    if (!grouped[eq.cat]) grouped[eq.cat] = [];
    grouped[eq.cat].push(eq);
  });

  const totalCount = node.equipment.reduce((s, e) => s + e.count, 0);
  let nodeMgrs = "";
  try { nodeMgrs = toMgrs([node.lng, node.lat], 5); } catch { /* */ }

  const addedEquipment = node.equipment.map(e => {
    const fromDb = allEquipment.find(eq => eq.id === e.tid);
    const fromLegacy = eqDb[e.tid];
    return {
      ...e,
      dbEntry: fromDb,
      legacyEntry: fromLegacy,
      name: fromDb?.name || fromLegacy?.name || e.tid,
      specs: fromDb
        ? `${fromDb.fuelBurnMoving}g/hr · ${fromDb.fuelCap}g cap · ${fromDb.speed}mph · ${fromDb.crew} crew`
        : fromLegacy
          ? `${fromLegacy.fuelBurn}g/hr · ${fromLegacy.fuelCap}g cap · ${fromLegacy.speed}mph · ${fromLegacy.crew} crew`
          : "",
    };
  }).filter(e => e.count > 0);

  const addEquipment = (eq: EquipmentType) => {
    const existing = node.equipment.find(e => e.tid === eq.id);
    if (existing) {
      onUpdate({ ...node, equipment: node.equipment.map(e => e.tid === eq.id ? { ...e, count: e.count + 1 } : e) });
    } else {
      onUpdate({ ...node, equipment: [...node.equipment, { tid: eq.id, count: 1, fuelPct: 100 }] });
      if (!eqDb[eq.id]) {
        onAddEquipType({ name: eq.name, cat: eq.cat, fuelBurn: eq.fuelBurnMoving, fuelCap: eq.fuelCap, speed: eq.speed, crew: eq.crew });
      }
    }
    setQuery("");
    setShowDropdown(false);
  };

  const setCount = (tid: string, v: string) => {
    const c = Math.max(0, parseInt(v) || 0);
    if (c === 0) {
      onUpdate({ ...node, equipment: node.equipment.filter(e => e.tid !== tid) });
    } else {
      onUpdate({ ...node, equipment: node.equipment.map(e => e.tid === tid ? { ...e, count: c } : e) });
    }
  };

  const setFuel = (tid: string, v: string) => {
    const p = Math.min(100, Math.max(0, parseInt(v) || 0));
    onUpdate({ ...node, equipment: node.equipment.map(e => e.tid === tid ? { ...e, fuelPct: p } : e) });
  };

  const removeEquipment = (tid: string) => {
    onUpdate({ ...node, equipment: node.equipment.filter(e => e.tid !== tid) });
  };

  const addNewType = () => {
    if (!newEq.name.trim()) return;
    onAddEquipType({ name: newEq.name, cat: newEq.cat, fuelBurn: newEq.fuelBurnMoving, fuelCap: newEq.fuelCap, speed: newEq.speed, crew: newEq.crew });
    setNewEq({ name: "", cat: "Wheeled", fuelBurnIdle: 2, fuelBurnMoving: 10, fuelCap: 50, speed: 50, crew: 2, cargo: 0 });
    setShowAdd(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="w-[280px] h-full bg-card flex flex-col panel-shadow overflow-hidden transition-all duration-200 ease-out">
      {/* Header */}
      <div className="bg-foreground px-3 py-2.5 flex items-center justify-between shrink-0">
        <div className="min-w-0 flex-1">
          <input
            value={node.name}
            onChange={e => onUpdate({ ...node, name: e.target.value })}
            className="bg-transparent border-0 border-b border-primary/50 text-primary-foreground font-medium text-[13px] outline-none w-full"
          />
          <div className="flex items-center gap-2 mt-1">
            {nodeMgrs && <span className="text-muted-foreground/70 text-[9px]">MGRS {nodeMgrs}</span>}
            <span className="text-primary/80 text-[9px] font-medium">{totalCount} vehicles</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 rounded hover:bg-primary-foreground/10 transition-colors duration-200 text-primary-foreground/70 hover:text-primary-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto p-2.5">
        {/* Search */}
        <div className="relative mb-2">
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder='Search... (e.g. "black hawk", "tank")'
            className="w-full p-2 pl-7 rounded text-[11px] outline-none bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/30 card-shadow transition-shadow duration-200"
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[11px]">⌕</span>

          {showDropdown && (
            <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-0.5 bg-card rounded-md panel-shadow max-h-[220px] overflow-auto z-50">
              {Object.keys(grouped).length === 0 ? (
                <div className="p-3 text-center text-muted-foreground text-[10px]">No matches</div>
              ) : (
                Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <div className="px-2 py-1 text-[8px] uppercase tracking-[1.5px] text-muted-foreground font-medium bg-secondary/50 sticky top-0">
                      {cat}
                    </div>
                    {items.map(eq => {
                      const alreadyAdded = node.equipment.some(e => e.tid === eq.id && e.count > 0);
                      return (
                        <button
                          key={eq.id}
                          onClick={() => addEquipment(eq)}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-primary/8 cursor-pointer border-0 bg-transparent flex items-center justify-between gap-1 transition-colors duration-150"
                        >
                          <div>
                            <div className="text-foreground text-[10px] font-medium">{eq.name}</div>
                            <div className="text-muted-foreground text-[8px]">
                              {eq.fuelBurnMoving}g/hr · {eq.fuelCap}g · {eq.speed}mph
                            </div>
                          </div>
                          {alreadyAdded && (
                            <span className="text-[7px] text-primary font-medium bg-primary/10 px-1 py-0.5 rounded">ADDED</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Added equipment cards */}
        {addedEquipment.length === 0 ? (
          <div className="text-center text-muted-foreground text-[10px] py-6 border border-dashed border-border rounded">
            Search above to add equipment
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {addedEquipment.map(eq => (
              <div key={eq.tid} className="bg-background rounded p-2 relative group card-shadow">
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground text-[10px] font-medium truncate">{eq.name}</div>
                    <div className="text-muted-foreground text-[8px] mt-0.5">{eq.specs}</div>
                  </div>
                  <button
                    onClick={() => removeEquipment(eq.tid)}
                    className="text-muted-foreground hover:text-destructive text-[10px] bg-transparent border-0 cursor-pointer p-0.5 opacity-40 group-hover:opacity-100 transition-opacity duration-200"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[8px]">Qty</span>
                    <input
                      type="number" min={0} max={999} value={eq.count}
                      onChange={e => setCount(eq.tid, e.target.value)}
                      className="w-[38px] bg-card border border-border text-center p-0.5 text-[10px] rounded-sm outline-none text-foreground"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[8px]">Fuel</span>
                    <input
                      type="number" min={0} max={100} value={eq.fuelPct}
                      onChange={e => setFuel(eq.tid, e.target.value)}
                      className="w-[38px] text-center p-0.5 text-[10px] rounded-sm outline-none"
                      style={{
                        background: eq.fuelPct < 30 ? 'hsl(0 80% 95%)' : 'hsl(var(--card))',
                        border: `1px solid ${eq.fuelPct < 30 ? 'hsl(var(--destructive) / 0.4)' : 'hsl(var(--border))'}`,
                        color: eq.fuelPct < 30 ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))',
                      }}
                    />
                    <span className="text-muted-foreground text-[8px]">%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Custom equipment */}
        <div className="mt-2.5">
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full p-1.5 bg-primary/8 border border-dashed border-primary/30 text-primary cursor-pointer rounded text-[10px] hover:bg-primary/12 transition-colors duration-200"
            >
              + Custom Equipment
            </button>
          ) : (
            <div className="border border-primary/30 rounded p-2 bg-primary/5">
              <div className="text-[9px] font-medium text-primary mb-1.5">New Equipment Type</div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div className="col-span-2">
                  <input placeholder="Name" value={newEq.name} onChange={e => setNewEq({ ...newEq, name: e.target.value })}
                    className="w-full p-1 border border-border rounded-sm text-[10px] outline-none" />
                </div>
                <div>
                  <label className="text-muted-foreground text-[8px]">Category</label>
                  <select value={newEq.cat} onChange={e => setNewEq({ ...newEq, cat: e.target.value })}
                    className="w-full p-1 border border-border rounded-sm text-[9px] outline-none">
                    {["Rotary Wing", "Armor", "IFV/APC", "Wheeled", "Logistics", "Artillery", "UAS", "Other"].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground text-[8px]">Crew</label>
                  <input type="number" value={newEq.crew} onChange={e => setNewEq({ ...newEq, crew: +e.target.value })}
                    className="w-full p-1 border border-border rounded-sm text-[10px] outline-none" />
                </div>
                <div>
                  <label className="text-muted-foreground text-[8px]">Fuel idle (g/hr)</label>
                  <input type="number" value={newEq.fuelBurnIdle} onChange={e => setNewEq({ ...newEq, fuelBurnIdle: +e.target.value })}
                    className="w-full p-1 border border-border rounded-sm text-[10px] outline-none" />
                </div>
                <div>
                  <label className="text-muted-foreground text-[8px]">Fuel moving (g/hr)</label>
                  <input type="number" value={newEq.fuelBurnMoving} onChange={e => setNewEq({ ...newEq, fuelBurnMoving: +e.target.value })}
                    className="w-full p-1 border border-border rounded-sm text-[10px] outline-none" />
                </div>
                <div>
                  <label className="text-muted-foreground text-[8px]">Fuel cap (gal)</label>
                  <input type="number" value={newEq.fuelCap} onChange={e => setNewEq({ ...newEq, fuelCap: +e.target.value })}
                    className="w-full p-1 border border-border rounded-sm text-[10px] outline-none" />
                </div>
                <div>
                  <label className="text-muted-foreground text-[8px]">Speed (mph)</label>
                  <input type="number" value={newEq.speed} onChange={e => setNewEq({ ...newEq, speed: +e.target.value })}
                    className="w-full p-1 border border-border rounded-sm text-[10px] outline-none" />
                </div>
              </div>
              <div className="flex gap-1.5 mt-2">
                <button onClick={addNewType} className="flex-1 p-1 bg-primary border-none text-primary-foreground rounded-sm cursor-pointer text-[10px] font-medium">Add</button>
                <button onClick={() => setShowAdd(false)} className="px-2 p-1 bg-background border border-border text-secondary-foreground rounded-sm cursor-pointer text-[10px]">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border shrink-0">
        <button
          onClick={onRemove}
          className="w-full p-1.5 bg-destructive/8 text-destructive cursor-pointer text-[9px] rounded hover:bg-destructive/15 transition-colors duration-200 border-0"
        >
          Remove Location
        </button>
      </div>
    </div>
  );
}

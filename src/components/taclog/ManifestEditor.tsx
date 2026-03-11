import { useState, useRef, useEffect } from "react";
import type { MapNode, EquipmentDB } from "@/lib/taclog-data";
import { EQUIPMENT_DB, searchEquipment, type EquipmentType } from "@/lib/equipment-db";

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

  // Group results by category
  const grouped: Record<string, EquipmentType[]> = {};
  results.forEach(eq => {
    if (!grouped[eq.cat]) grouped[eq.cat] = [];
    grouped[eq.cat].push(eq);
  });

  // Equipment currently added to this node
  const addedEquipment = node.equipment.map(e => {
    const fromDb = allEquipment.find(eq => eq.id === e.tid);
    const fromLegacy = eqDb[e.tid];
    return {
      ...e,
      dbEntry: fromDb,
      legacyEntry: fromLegacy,
      name: fromDb?.name || fromLegacy?.name || e.tid,
      specs: fromDb
        ? `${fromDb.fuelBurnMoving} gal/hr · ${fromDb.fuelCap} gal cap · ${fromDb.speed} mph · ${fromDb.crew} crew`
        : fromLegacy
          ? `${fromLegacy.fuelBurn} gal/hr · ${fromLegacy.fuelCap} gal cap · ${fromLegacy.speed} mph · ${fromLegacy.crew} crew`
          : "",
    };
  }).filter(e => e.count > 0);

  const addEquipment = (eq: EquipmentType) => {
    const existing = node.equipment.find(e => e.tid === eq.id);
    if (existing) {
      onUpdate({ ...node, equipment: node.equipment.map(e => e.tid === eq.id ? { ...e, count: e.count + 1 } : e) });
    } else {
      onUpdate({ ...node, equipment: [...node.equipment, { tid: eq.id, count: 1, fuelPct: 100 }] });
      // Also register in legacy eqDb for logistics calculations
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
    const newId = newEq.name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_custom";
    // Register in legacy db
    onAddEquipType({ name: newEq.name, cat: newEq.cat, fuelBurn: newEq.fuelBurnMoving, fuelCap: newEq.fuelCap, speed: newEq.speed, crew: newEq.crew });
    setNewEq({ name: "", cat: "Wheeled", fuelBurnIdle: 2, fuelBurnMoving: 10, fuelCap: 50, speed: 50, crew: 2, cargo: 0 });
    setShowAdd(false);
  };

  // Close dropdown on outside click
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
    <div>
      <div className="bg-card border border-border rounded-md p-3.5 w-[360px] max-h-[70vh] overflow-auto text-xs shadow-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-2.5">
          <div>
            <input
              value={node.name}
              onChange={e => onUpdate({ ...node, name: e.target.value })}
              className="bg-transparent border-0 border-b-2 border-primary text-primary font-bold text-[15px] font-mono outline-none w-[210px]"
            />
            <div className="text-muted-foreground text-[10px] mt-1">Search & add equipment below</div>
          </div>
          <button onClick={onClose} className="bg-secondary border border-border text-secondary-foreground cursor-pointer px-2.5 py-1 rounded font-mono text-[13px]">✕</button>
        </div>

        {/* Search */}
        <div className="relative mb-2.5">
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search equipment... (e.g. black hawk, tank, 60)"
            className="w-full p-2 pl-7 border border-border rounded font-mono text-[11px] outline-none bg-background text-foreground placeholder:text-muted-foreground focus:border-primary"
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[11px]">⌕</span>

          {/* Dropdown */}
          {showDropdown && (
            <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-0.5 bg-card border border-border rounded shadow-lg max-h-[240px] overflow-auto z-50">
              {Object.keys(grouped).length === 0 ? (
                <div className="p-3 text-center text-muted-foreground text-[10px]">No matches found</div>
              ) : (
                Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <div className="px-2 py-1 text-[9px] uppercase tracking-[1.5px] text-muted-foreground font-semibold bg-secondary/50 border-b border-border sticky top-0">
                      {cat}
                    </div>
                    {items.map(eq => {
                      const alreadyAdded = node.equipment.some(e => e.tid === eq.id && e.count > 0);
                      return (
                        <button
                          key={eq.id}
                          onClick={() => addEquipment(eq)}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-primary/10 cursor-pointer border-0 bg-transparent flex items-center justify-between gap-1 transition-colors"
                        >
                          <div>
                            <div className="text-foreground text-[11px] font-medium">{eq.name}</div>
                            <div className="text-muted-foreground text-[9px]">
                              {eq.fuelBurnMoving} gal/hr · {eq.fuelCap} gal · {eq.speed} mph · {eq.crew} crew
                            </div>
                          </div>
                          {alreadyAdded && (
                            <span className="text-[8px] text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded">ADDED</span>
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
          <div className="text-center text-muted-foreground text-[10px] py-4 border border-dashed border-border rounded">
            No equipment added. Use search above to add vehicles.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {addedEquipment.map(eq => (
              <div key={eq.tid} className="bg-secondary/30 border border-border rounded p-2 relative group">
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground text-[11px] font-semibold truncate">{eq.name}</div>
                    <div className="text-muted-foreground text-[9px] mt-0.5">{eq.specs}</div>
                  </div>
                  <button
                    onClick={() => removeEquipment(eq.tid)}
                    className="text-muted-foreground hover:text-destructive text-[11px] bg-transparent border-0 cursor-pointer p-0.5 opacity-50 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[9px]">Qty</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={eq.count}
                      onChange={e => setCount(eq.tid, e.target.value)}
                      className="w-[42px] bg-background border border-border text-center p-1 font-mono text-[11px] rounded-sm outline-none text-foreground"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[9px]">Fuel</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={eq.fuelPct}
                      onChange={e => setFuel(eq.tid, e.target.value)}
                      className="w-[42px] text-center p-1 font-mono text-[11px] rounded-sm outline-none"
                      style={{
                        background: eq.fuelPct < 30 ? 'hsl(0 80% 95%)' : 'hsl(var(--background))',
                        border: `1px solid ${eq.fuelPct < 30 ? 'hsl(var(--destructive) / 0.5)' : 'hsl(var(--border))'}`,
                        color: eq.fuelPct < 30 ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))',
                      }}
                    />
                    <span className="text-muted-foreground text-[9px]">%</span>
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
              className="w-full p-1.5 bg-primary/10 border border-dashed border-primary text-primary cursor-pointer rounded font-mono text-[11px]"
            >
              + Add Custom Equipment Type
            </button>
          ) : (
            <div className="border border-primary rounded p-2.5 bg-primary/5">
              <div className="text-[10px] font-semibold text-primary mb-1.5">New Equipment Type</div>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <div className="col-span-2">
                  <input
                    placeholder="Name (e.g. MQ-1C Gray Eagle)"
                    value={newEq.name}
                    onChange={e => setNewEq({ ...newEq, name: e.target.value })}
                    className="w-full p-1 border border-border rounded-sm font-mono text-[11px] outline-none"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-[9px]">Category</label>
                  <select
                    value={newEq.cat}
                    onChange={e => setNewEq({ ...newEq, cat: e.target.value })}
                    className="w-full p-1 border border-border rounded-sm font-mono text-[10px] outline-none"
                  >
                    {["Rotary Wing", "Armor", "IFV/APC", "Wheeled", "Logistics", "Artillery", "UAS", "Other"].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground text-[9px]">Crew</label>
                  <input type="number" value={newEq.crew} onChange={e => setNewEq({ ...newEq, crew: +e.target.value })}
                    className="w-full p-1 border border-border rounded-sm font-mono text-[11px] outline-none" />
                </div>
                <div>
                  <label className="text-muted-foreground text-[9px]">Fuel idle (gal/hr)</label>
                  <input type="number" value={newEq.fuelBurnIdle} onChange={e => setNewEq({ ...newEq, fuelBurnIdle: +e.target.value })}
                    className="w-full p-1 border border-border rounded-sm font-mono text-[11px] outline-none" />
                </div>
                <div>
                  <label className="text-muted-foreground text-[9px]">Fuel moving (gal/hr)</label>
                  <input type="number" value={newEq.fuelBurnMoving} onChange={e => setNewEq({ ...newEq, fuelBurnMoving: +e.target.value })}
                    className="w-full p-1 border border-border rounded-sm font-mono text-[11px] outline-none" />
                </div>
                <div>
                  <label className="text-muted-foreground text-[9px]">Fuel capacity (gal)</label>
                  <input type="number" value={newEq.fuelCap} onChange={e => setNewEq({ ...newEq, fuelCap: +e.target.value })}
                    className="w-full p-1 border border-border rounded-sm font-mono text-[11px] outline-none" />
                </div>
                <div>
                  <label className="text-muted-foreground text-[9px]">Speed (mph)</label>
                  <input type="number" value={newEq.speed} onChange={e => setNewEq({ ...newEq, speed: +e.target.value })}
                    className="w-full p-1 border border-border rounded-sm font-mono text-[11px] outline-none" />
                </div>
              </div>
              <div className="flex gap-1.5 mt-2">
                <button onClick={addNewType} className="flex-1 p-1.5 bg-primary border-none text-primary-foreground rounded-sm cursor-pointer font-mono text-[11px] font-semibold">Add Type</button>
                <button onClick={() => setShowAdd(false)} className="px-2.5 p-1.5 bg-background border border-border text-secondary-foreground rounded-sm cursor-pointer font-mono text-[11px]">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        className="mt-1 w-full p-1.5 bg-destructive/10 border border-destructive/30 text-destructive cursor-pointer font-mono text-[10px] rounded"
      >
        Remove Location
      </button>
    </div>
  );
}

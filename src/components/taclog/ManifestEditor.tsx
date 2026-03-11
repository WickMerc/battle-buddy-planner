import { useState } from "react";
import type { MapNode, EquipmentDB } from "@/lib/taclog-data";

interface ManifestEditorProps {
  node: MapNode;
  eqDb: EquipmentDB;
  onUpdate: (node: MapNode) => void;
  onClose: () => void;
  onRemove: () => void;
  onAddEquipType: (eq: { name: string; cat: string; fuelBurn: number; fuelCap: number; speed: number; crew: number }) => void;
}

export default function ManifestEditor({ node, eqDb, onUpdate, onClose, onRemove, onAddEquipType }: ManifestEditorProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newEq, setNewEq] = useState({ name: "", cat: "Wheeled", fuelBurn: 10, fuelCap: 50, speed: 50, crew: 2 });

  const cats: Record<string, { id: string; name: string; cat: string; fuelBurn: number }[]> = {};
  Object.entries(eqDb).forEach(([id, eq]) => {
    if (!cats[eq.cat]) cats[eq.cat] = [];
    cats[eq.cat].push({ id, name: eq.name, cat: eq.cat, fuelBurn: eq.fuelBurn });
  });

  const getEq = (tid: string) => node.equipment.find(e => e.tid === tid);

  const setCount = (tid: string, v: string) => {
    const c = Math.max(0, parseInt(v) || 0);
    const ex = node.equipment.find(e => e.tid === tid);
    const ne = ex
      ? node.equipment.map(e => e.tid === tid ? { ...e, count: c } : e)
      : [...node.equipment, { tid, count: c, fuelPct: 100 }];
    onUpdate({ ...node, equipment: ne.filter(e => e.count > 0) });
  };

  const setFuel = (tid: string, v: string) => {
    const p = Math.min(100, Math.max(0, parseInt(v) || 0));
    onUpdate({ ...node, equipment: node.equipment.map(e => e.tid === tid ? { ...e, fuelPct: p } : e) });
  };

  const addNewType = () => {
    if (!newEq.name.trim()) return;
    onAddEquipType(newEq);
    setNewEq({ name: "", cat: "Wheeled", fuelBurn: 10, fuelCap: 50, speed: 50, crew: 2 });
    setShowAdd(false);
  };

  return (
    <div>
      <div className="bg-card border border-border rounded-md p-3.5 w-[360px] max-h-[70vh] overflow-auto text-xs shadow-lg">
        <div className="flex justify-between items-center mb-2.5">
          <div>
            <input
              value={node.name}
              onChange={e => onUpdate({ ...node, name: e.target.value })}
              className="bg-transparent border-0 border-b-2 border-primary text-primary font-bold text-[15px] font-mono outline-none w-[210px]"
            />
            <div className="text-muted-foreground text-[10px] mt-1">Set vehicle counts and starting fuel %</div>
          </div>
          <button onClick={onClose} className="bg-secondary border border-border text-secondary-foreground cursor-pointer px-2.5 py-1 rounded font-mono text-[13px]">✕</button>
        </div>

        {Object.entries(cats).map(([cat, items]) => (
          <div key={cat} className="mb-2">
            <div className="text-muted-foreground text-[9px] uppercase tracking-[2px] mb-1 border-b border-border pb-1 font-semibold">
              {cat}
            </div>
            {items.map(item => {
              const eq = getEq(item.id);
              const count = eq?.count || 0;
              const fuel = eq?.fuelPct ?? 100;
              return (
                <div key={item.id} className="flex items-center py-1 gap-2" style={{ opacity: count > 0 ? 1 : 0.55 }}>
                  <span className="text-foreground w-[140px] text-[11px]" style={{ fontWeight: count > 0 ? 600 : 400 }}>{item.name}</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={count}
                    onChange={e => setCount(item.id, e.target.value)}
                    className="w-[46px] bg-white border border-border text-center p-1 font-mono text-xs rounded-sm outline-none text-foreground"
                  />
                  {count > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-[9px]">fuel</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={fuel}
                        onChange={e => setFuel(item.id, e.target.value)}
                        className="w-10 text-center p-1 font-mono text-[11px] rounded-sm outline-none"
                        style={{
                          background: fuel < 30 ? 'hsl(0 80% 95%)' : 'white',
                          border: `1px solid ${fuel < 30 ? 'hsl(var(--tac-red) / 0.5)' : 'hsl(var(--border))'}`,
                          color: fuel < 30 ? 'hsl(var(--tac-red))' : 'hsl(var(--foreground))',
                        }}
                      />
                      <span className="text-muted-foreground text-[9px]">%</span>
                    </div>
                  )}
                  <span className="text-muted-foreground text-[9px] ml-auto">{item.fuelBurn}g/h</span>
                </div>
              );
            })}
          </div>
        ))}

        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full p-1.5 bg-primary/10 border border-dashed border-primary text-primary cursor-pointer rounded font-mono text-[11px] mt-1"
          >
            + Add Custom Equipment Type
          </button>
        ) : (
          <div className="border border-primary rounded p-2.5 mt-1 bg-primary/5">
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
                  {["Rotary Wing", "Armor", "IFV", "Wheeled", "Logistics", "Artillery", "UAS", "Other"].map(c => (
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
                <label className="text-muted-foreground text-[9px]">Fuel burn (gal/hr)</label>
                <input type="number" value={newEq.fuelBurn} onChange={e => setNewEq({ ...newEq, fuelBurn: +e.target.value })}
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
              <button onClick={() => setShowAdd(false)} className="px-2.5 p-1.5 bg-white border border-border text-secondary-foreground rounded-sm cursor-pointer font-mono text-[11px]">Cancel</button>
            </div>
          </div>
        )}
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

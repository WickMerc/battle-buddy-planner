import { EQUIPMENT_TYPES, CAT_LABELS, type MapNode } from "@/lib/taclog-data";

interface ManifestEditorProps {
  node: MapNode;
  onUpdate: (node: MapNode) => void;
  onClose: () => void;
  onRemove: () => void;
}

export default function ManifestEditor({ node, onUpdate, onClose, onRemove }: ManifestEditorProps) {
  const cats: Record<string, { id: string; name: string; category: string }[]> = {};
  Object.entries(EQUIPMENT_TYPES).forEach(([id, eq]) => {
    if (!cats[eq.category]) cats[eq.category] = [];
    cats[eq.category].push({ id, ...eq });
  });

  const getEq = (tid: string) => node.equipment.find(e => e.typeId === tid);

  const setCount = (tid: string, v: string) => {
    const c = Math.max(0, parseInt(v) || 0);
    const ex = node.equipment.find(e => e.typeId === tid);
    const newEq = ex
      ? node.equipment.map(e => e.typeId === tid ? { ...e, count: c } : e)
      : [...node.equipment, { typeId: tid, count: c, startFuelPct: 100 }];
    onUpdate({ ...node, equipment: newEq.filter(e => e.count > 0) });
  };

  const setFuel = (tid: string, v: string) => {
    const p = Math.min(100, Math.max(0, parseInt(v) || 0));
    onUpdate({ ...node, equipment: node.equipment.map(e => e.typeId === tid ? { ...e, startFuelPct: p } : e) });
  };

  return (
    <div>
      <div className="bg-card border border-border p-3.5 w-[340px] max-h-[65vh] overflow-auto text-[11px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between items-center mb-2.5">
          <div>
            <input
              value={node.name}
              onChange={e => onUpdate({ ...node, name: e.target.value })}
              className="bg-transparent border-0 border-b border-border text-primary font-bold text-sm font-mono outline-none w-[200px]"
            />
            <div className="text-muted-foreground text-[9px] mt-0.5">Set vehicle counts and starting fuel %</div>
          </div>
          <button onClick={onClose} className="bg-transparent border border-border text-muted-foreground cursor-pointer px-2 py-0.5 font-mono">✕</button>
        </div>

        {Object.entries(cats).map(([cat, items]) => (
          <div key={cat} className="mb-2">
            <div className="text-muted-foreground text-[8px] uppercase tracking-[2px] mb-1 border-b border-muted pb-0.5">
              {CAT_LABELS[cat]}
            </div>
            {items.map(item => {
              const eq = getEq(item.id);
              const count = eq?.count || 0;
              const fuel = eq?.startFuelPct ?? 100;
              return (
                <div key={item.id} className="flex items-center py-0.5 gap-1.5" style={{ opacity: count > 0 ? 1 : 0.45 }}>
                  <span className="text-secondary-foreground w-[125px] text-[10px]">{item.name}</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={count}
                    onChange={e => setCount(item.id, e.target.value)}
                    className="w-[42px] bg-background border border-border text-center p-0.5 font-mono text-[11px] outline-none"
                    style={{ color: count > 0 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}
                  />
                  {count > 0 && (
                    <div className="flex items-center gap-0.5">
                      <span className="text-muted-foreground text-[8px]">FUEL</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={fuel}
                        onChange={e => setFuel(item.id, e.target.value)}
                        className="w-9 bg-background border text-center p-0.5 font-mono text-[10px] outline-none"
                        style={{
                          borderColor: fuel < 30 ? 'hsl(var(--tac-red) / 0.4)' : 'hsl(var(--border))',
                          color: fuel < 30 ? 'hsl(var(--tac-red))' : 'hsl(var(--tac-green) / 0.7)',
                        }}
                      />
                      <span className="text-muted-foreground text-[8px]">%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <button
        onClick={onRemove}
        className="mt-1 w-full p-1 bg-destructive/10 border border-destructive/30 text-destructive cursor-pointer font-mono text-[9px]"
      >
        Remove Location
      </button>
    </div>
  );
}

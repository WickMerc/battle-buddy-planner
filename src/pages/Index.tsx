import { useState, useRef, useEffect } from "react";
import {
  DEFAULT_EQUIPMENT, computeLog, buildCtx, gid, dist, px2mi, bounds, classifyShape,
  type MapNode, type ChatMessage, type LogisticsResult, type EquipmentDB,
} from "@/lib/taclog-data";
import ManifestEditor from "@/components/taclog/ManifestEditor";
import LogisticsPanel from "@/components/taclog/LogisticsPanel";
import ChatPanel from "@/components/taclog/ChatPanel";

const INITIAL_NODES: MapNode[] = [
  { id: "n1", x: 180, y: 280, name: "FOB Alpha", shape: "point", equipment: [] },
  { id: "n2", x: 500, y: 140, name: "LZ Bravo", shape: "point", equipment: [] },
];

interface PendingShape {
  type: "circle" | "rect";
  bounds: ReturnType<typeof bounds>;
  points: { x: number; y: number }[];
}

export default function Index() {
  const [eqDb, setEqDb] = useState<EquipmentDB>(DEFAULT_EQUIPMENT);
  const [nodes, setNodes] = useState<MapNode[]>(INITIAL_NODES);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [editNode, setEditNode] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [chat, setChat] = useState<ChatMessage[]>([
    { role: "system", text: "TACLOG AI ready. I see your battlefield. Load equipment into locations and ask me about fuel, resupply, movement costs, or mission planning." },
  ]);
  const [chatIn, setChatIn] = useState("");
  const [chatLoad, setChatLoad] = useState(false);
  const [rightTab, setRightTab] = useState<"logistics" | "chat">("logistics");
  const [drawMode, setDrawMode] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [stroke, setStroke] = useState<{ x: number; y: number }[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pendingShape, setPendingShape] = useState<PendingShape | null>(null);
  const [shapeName, setShapeName] = useState("");
  const mapRef = useRef<SVGSVGElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => { if (pendingShape && nameInput.current) nameInput.current.focus(); }, [pendingShape]);

  const log = computeLog(nodes, eqDb, hours);

  const addEquipType = (eq: { name: string; cat: string; fuelBurn: number; fuelCap: number; speed: number; crew: number }) => {
    const id = eq.name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + gid().substr(0, 4);
    setEqDb(prev => ({ ...prev, [id]: { ...eq } }));
  };

  const xy = (e: React.MouseEvent): { x: number; y: number } | null => {
    if (!mapRef.current) return null;
    const r = mapRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onMapClick = (e: React.MouseEvent) => {
    if (drawMode || dragId || pendingShape) return;
    setSelNode(null);
    setEditNode(null);
  };

  const onDown = (e: React.MouseEvent) => {
    if (!drawMode || pendingShape) return;
    const p = xy(e);
    if (p) { setDrawing(true); setStroke([p]); }
  };

  const onMove = (e: React.MouseEvent) => {
    if (dragId) {
      const p = xy(e);
      if (p) setNodes(prev => prev.map(n => n.id === dragId ? { ...n, x: p.x, y: p.y } : n));
      return;
    }
    if (!drawing || !stroke) return;
    const p = xy(e);
    if (p) setStroke(prev => prev ? [...prev, p] : [p]);
  };

  const onUp = () => {
    if (dragId) { setDragId(null); return; }
    if (drawing && stroke && stroke.length > 5) {
      const shape = classifyShape(stroke);
      const b = bounds(stroke);
      if (shape === "circle" || shape === "rect") {
        setPendingShape({ type: shape, bounds: b, points: stroke });
        setShapeName("");
      }
    }
    setDrawing(false);
    setStroke(null);
  };

  const confirmShape = () => {
    if (!pendingShape) return;
    const name = shapeName.trim() || `Position ${nodes.length + 1}`;
    const b = pendingShape.bounds;
    const newNode: MapNode = {
      id: gid(), x: b.cx, y: b.cy, name,
      shape: pendingShape.type,
      shapeData: pendingShape.type === "circle"
        ? { cx: b.cx, cy: b.cy, rx: b.w / 2, ry: b.h / 2 }
        : { x: b.minX, y: b.minY, w: b.w, h: b.h },
      equipment: [],
    };
    setNodes(prev => [...prev, newNode]);
    setPendingShape(null);
    setShapeName("");
    setSelNode(newNode.id);
    setEditNode(newNode.id);
    setDrawMode(false);
  };

  const onNodeClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (drawMode) return;
    setSelNode(id);
    setEditNode(id);
  };

  const onNodeDrag = (e: React.MouseEvent, id: string) => {
    if (drawMode) return;
    e.stopPropagation();
    setDragId(id);
    setSelNode(id);
  };

  const updateNode = (u: MapNode) => setNodes(prev => prev.map(n => n.id === u.id ? u : n));
  const removeNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    if (editNode === id) setEditNode(null);
    if (selNode === id) setSelNode(null);
  };

  const sendChat = async () => {
    const msg = chatIn.trim();
    if (!msg || chatLoad) return;
    setChatIn("");
    setChat(prev => [...prev, { role: "user", text: msg }]);
    setChatLoad(true);

    const ctx = buildCtx(nodes, eqDb, log, hours);
    setTimeout(() => {
      setChat(prev => [...prev, {
        role: "assistant",
        text: `Based on the current ${hours}hr operational window:\n\nTotal fuel requirement: ${log.fuel.toLocaleString()} gallons\nHEMTT sorties needed: ${log.hemtt}\nTotal personnel: ${log.crew}\n\nNote: AI chat requires backend integration. Connect to Lovable Cloud to enable full AI analysis.`,
      }]);
      setChatLoad(false);
    }, 800);
  };

  const editData = nodes.find(n => n.id === editNode);
  const grid = Array.from({ length: 60 }, (_, i) => i * 25);

  return (
    <div className="w-full h-screen flex flex-col bg-background font-mono text-foreground overflow-hidden text-xs">
      {/* TOOLBAR */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-primary font-extrabold text-[15px] tracking-[2px]">⬡ TACLOG</span>
          <span className="text-muted-foreground text-[9px] tracking-[1px]">TACTICAL LOGISTICS PLANNER</span>
        </div>
        <div className="flex gap-1.5 items-center">
          <button
            onClick={() => setDrawMode(!drawMode)}
            className="px-3.5 py-1.5 text-[11px] font-mono border cursor-pointer rounded transition-colors"
            style={{
              background: drawMode ? 'hsl(var(--primary) / 0.1)' : 'white',
              borderColor: drawMode ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              color: drawMode ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              fontWeight: drawMode ? 600 : 400,
            }}
          >
            {drawMode ? "✎ Drawing — draw a shape" : "✎ Draw Location"}
          </button>
          <div className="w-px h-[18px] bg-border mx-1" />
          <span className="text-muted-foreground text-[10px]">Mission:</span>
          <input
            type="range"
            min={1}
            max={72}
            value={hours}
            onChange={e => setHours(+e.target.value)}
            className="w-20"
            style={{ accentColor: 'hsl(var(--primary))' }}
          />
          <span className="text-primary font-bold text-[13px] min-w-[32px]">{hours}h</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* MAP */}
        <div className="flex-1 relative overflow-hidden">
          <svg
            ref={mapRef}
            width="100%"
            height="100%"
            className="bg-tac-bg"
            style={{ cursor: drawMode ? "crosshair" : "default" }}
            onClick={onMapClick}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
          >
            {grid.map(p => (
              <g key={p}>
                <line x1={p} y1={0} x2={p} y2={2000} stroke="hsl(var(--tac-grid))" strokeWidth={0.4} />
                <line x1={0} y1={p} x2={2000} y2={p} stroke="hsl(var(--tac-grid))" strokeWidth={0.4} />
              </g>
            ))}

            {/* Terrain */}
            <ellipse cx={370} cy={200} rx={60} ry={35} fill="hsl(80 20% 78%)" stroke="hsl(80 20% 65%)" strokeWidth={0.8} opacity={0.5} />
            <text x={370} y={204} fill="hsl(80 15% 55%)" fontSize={8} textAnchor="middle" fontFamily="monospace">HILL 204</text>
            <rect x={450} y={260} width={120} height={10} fill="hsl(200 30% 78%)" rx={5} stroke="hsl(200 25% 70%)" strokeWidth={0.6} opacity={0.5} />
            <text x={510} y={268} fill="hsl(200 25% 55%)" fontSize={7} textAnchor="middle" fontFamily="monospace">RIVER</text>

            {/* Distance lines */}
            {selNode && nodes.filter(n => n.id !== selNode).map(n => {
              const s = nodes.find(x => x.id === selNode);
              if (!s) return null;
              const d = px2mi(dist(s, n)).toFixed(1);
              const mx = (s.x + n.x) / 2, my = (s.y + n.y) / 2;
              return (
                <g key={n.id}>
                  <line x1={s.x} y1={s.y} x2={n.x} y2={n.y} stroke="hsl(var(--muted-foreground))" strokeWidth={0.8} strokeDasharray="6,4" opacity={0.5} />
                  <rect x={mx - 20} y={my - 8} width={40} height={14} fill="hsl(var(--card))" rx={3} stroke="hsl(var(--border))" strokeWidth={0.5} />
                  <text x={mx} y={my + 2} fill="hsl(var(--secondary-foreground))" fontSize={9} textAnchor="middle" fontWeight="600" fontFamily="monospace">{d}mi</text>
                </g>
              );
            })}

            {/* Node shapes */}
            {nodes.map(n => {
              if (n.shape === "circle" && n.shapeData)
                return <ellipse key={`sh-${n.id}`} cx={n.shapeData.cx} cy={n.shapeData.cy} rx={n.shapeData.rx} ry={n.shapeData.ry}
                  fill="hsl(var(--tac-shape) / 0.06)" stroke="hsl(var(--tac-shape))" strokeWidth={1.5} strokeDasharray="6,3" opacity={selNode === n.id ? 0.8 : 0.5} />;
              if (n.shape === "rect" && n.shapeData)
                return <rect key={`sh-${n.id}`} x={n.shapeData.x} y={n.shapeData.y} width={n.shapeData.w} height={n.shapeData.h}
                  fill="hsl(var(--tac-shape) / 0.06)" stroke="hsl(var(--tac-shape))" strokeWidth={1.5} strokeDasharray="6,3" rx={3} opacity={selNode === n.id ? 0.8 : 0.5} />;
              return null;
            })}

            {/* Pending shape preview */}
            {pendingShape && (
              pendingShape.type === "circle"
                ? <ellipse cx={pendingShape.bounds.cx} cy={pendingShape.bounds.cy} rx={pendingShape.bounds.w / 2} ry={pendingShape.bounds.h / 2}
                    fill="hsl(var(--tac-info) / 0.1)" stroke="hsl(var(--tac-info))" strokeWidth={2} strokeDasharray="8,4">
                    <animate attributeName="stroke-opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
                  </ellipse>
                : <rect x={pendingShape.bounds.minX} y={pendingShape.bounds.minY} width={pendingShape.bounds.w} height={pendingShape.bounds.h}
                    fill="hsl(var(--tac-info) / 0.1)" stroke="hsl(var(--tac-info))" strokeWidth={2} strokeDasharray="8,4" rx={3}>
                    <animate attributeName="stroke-opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
                  </rect>
            )}

            {/* Active stroke */}
            {stroke && <polyline points={stroke.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="hsl(var(--tac-shape))" strokeWidth={2} strokeLinecap="round" opacity={0.5} />}

            {/* Nodes */}
            {nodes.map(node => {
              const isSel = selNode === node.id;
              const cnt = node.equipment.reduce((s, e) => s + e.count, 0);
              const nl = log.nodes.find(r => r.id === node.id);
              return (
                <g key={node.id} onMouseDown={e => onNodeDrag(e, node.id)} onClick={e => onNodeClick(e, node.id)} style={{ cursor: drawMode ? "crosshair" : "pointer" }}>
                  {isSel && (
                    <circle cx={node.x} cy={node.y} r={26} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} opacity={0.4} strokeDasharray="4,3">
                      <animate attributeName="r" values="24;30;24" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle cx={node.x} cy={node.y} r={16} fill="hsl(var(--card))" stroke={isSel ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} strokeWidth={isSel ? 2.5 : 1.5} />
                  <circle cx={node.x} cy={node.y} r={3} fill={cnt > 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} />
                  <text x={node.x} y={node.y + 26} fill={isSel ? "hsl(var(--primary))" : "hsl(var(--secondary-foreground))"} fontSize={10} textAnchor="middle" fontWeight={700} fontFamily="monospace">{node.name}</text>
                  {cnt > 0 && (
                    <>
                      <rect x={node.x + 10} y={node.y - 22} width={18} height={14} fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary))" strokeWidth={0.8} rx={3} />
                      <text x={node.x + 19} y={node.y - 12} fill="hsl(var(--primary))" fontSize={9} textAnchor="middle" fontWeight="700" fontFamily="monospace">{cnt}</text>
                    </>
                  )}
                  {nl && nl.fuel > 0 && (
                    <text x={node.x} y={node.y + 37} fill="hsl(var(--muted-foreground))" fontSize={8} textAnchor="middle" fontFamily="monospace">{nl.fuel.toLocaleString()}g</text>
                  )}
                </g>
              );
            })}

            {/* Scale */}
            <g transform="translate(16,16)">
              <line x1={0} y1={0} x2={83} y2={0} stroke="hsl(var(--muted-foreground))" strokeWidth={0.8} />
              <line x1={0} y1={-3} x2={0} y2={3} stroke="hsl(var(--muted-foreground))" />
              <line x1={83} y1={-3} x2={83} y2={3} stroke="hsl(var(--muted-foreground))" />
              <text x={41} y={-5} fill="hsl(var(--muted-foreground))" fontSize={8} textAnchor="middle" fontFamily="monospace">10 mi</text>
            </g>
          </svg>

          {/* Shape naming dialog */}
          {pendingShape && (
            <div
              className="absolute bg-white border-2 border-tac-info rounded-lg p-3.5 w-[200px] shadow-lg z-30"
              style={{ top: pendingShape.bounds.cy - 50, left: pendingShape.bounds.cx - 100 }}
            >
              <div className="text-[11px] font-semibold text-tac-info mb-1.5">
                {pendingShape.type === "circle" ? "Circle" : "Rectangle"} detected — name this location:
              </div>
              <input
                ref={nameInput}
                value={shapeName}
                onChange={e => setShapeName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmShape()}
                placeholder="e.g. FOB Delta, LZ Hawk..."
                className="w-full p-1.5 border border-border rounded font-mono text-xs outline-none mb-2"
              />
              <div className="flex gap-1.5">
                <button onClick={confirmShape} className="flex-1 p-1.5 bg-tac-info border-none text-white rounded cursor-pointer font-mono font-semibold text-[11px]">Create Location</button>
                <button onClick={() => setPendingShape(null)} className="px-2.5 p-1.5 bg-white border border-border text-secondary-foreground rounded cursor-pointer font-mono text-[11px]">Cancel</button>
              </div>
            </div>
          )}

          {/* Editor overlay */}
          {editData && !pendingShape && (
            <div className="absolute top-2.5 left-2.5 z-20">
              <ManifestEditor
                node={editData}
                eqDb={eqDb}
                onUpdate={updateNode}
                onClose={() => setEditNode(null)}
                onRemove={() => removeNode(editData.id)}
                onAddEquipType={addEquipType}
              />
            </div>
          )}

          {/* Status */}
          <div className="absolute bottom-2 left-2 bg-card/90 border border-border rounded px-2.5 py-1 text-[10px] text-muted-foreground">
            {drawMode ? (
              <span className="text-tac-info font-semibold">Draw a circle or rectangle to create a location</span>
            ) : (
              <span>Click location to edit · Drag to reposition</span>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-[300px] bg-card border-l border-border flex flex-col shrink-0">
          <div className="flex border-b border-border">
            {(["logistics", "chat"] as const).map(t => (
              <button
                key={t}
                onClick={() => setRightTab(t)}
                className="flex-1 py-2 border-0 cursor-pointer text-[10px] uppercase tracking-[1.5px] font-mono font-semibold transition-colors"
                style={{
                  background: rightTab === t ? 'hsl(var(--card))' : 'hsl(var(--secondary))',
                  borderBottom: rightTab === t ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                  color: rightTab === t ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                }}
              >
                {t === "chat" ? "AI Chat" : "Logistics"}
              </button>
            ))}
          </div>

          {rightTab === "logistics" && (
            <LogisticsPanel
              log={log}
              hours={hours}
              onSelectNode={(id) => { setSelNode(id); setEditNode(id); }}
            />
          )}

          {rightTab === "chat" && (
            <ChatPanel
              chat={chat}
              chatIn={chatIn}
              setChatIn={setChatIn}
              chatLoad={chatLoad}
              onSend={sendChat}
            />
          )}
        </div>
      </div>
    </div>
  );
}

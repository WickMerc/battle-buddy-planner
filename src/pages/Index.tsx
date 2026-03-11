import { useState, useRef, useCallback } from "react";
import {
  EQUIPMENT_TYPES, computeLogistics, buildCtx, gid, dist, px2mi,
  type MapNode, type ChatMessage, type DrawStroke, type LogisticsResult,
} from "@/lib/taclog-data";
import ManifestEditor from "@/components/taclog/ManifestEditor";
import LogisticsPanel from "@/components/taclog/LogisticsPanel";
import ChatPanel from "@/components/taclog/ChatPanel";

const INITIAL_NODES: MapNode[] = [
  { id: "n1", x: 160, y: 300, name: "FOB Alpha", equipment: [] },
  { id: "n2", x: 480, y: 130, name: "LZ Bravo", equipment: [] },
  { id: "n3", x: 620, y: 350, name: "AA Charlie", equipment: [] },
];

export default function Index() {
  const [nodes, setNodes] = useState<MapNode[]>(INITIAL_NODES);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [editNode, setEditNode] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [chat, setChat] = useState<ChatMessage[]>([
    { role: "system", text: "TACLOG AI online. I see your full battlefield picture. Ask me about fuel requirements, resupply planning, movement costs, or mission feasibility." },
  ]);
  const [chatIn, setChatIn] = useState("");
  const [chatLoad, setChatLoad] = useState(false);
  const [rightTab, setRightTab] = useState<"logistics" | "chat">("logistics");
  const [placing, setPlacing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [draws, setDraws] = useState<DrawStroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [stroke, setStroke] = useState<{ x: number; y: number }[] | null>(null);
  const mapRef = useRef<SVGSVGElement>(null);

  const log = computeLogistics(nodes, hours);

  const xy = (e: React.MouseEvent): { x: number; y: number } | null => {
    if (!mapRef.current) return null;
    const r = mapRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onMapClick = (e: React.MouseEvent) => {
    if (drawMode || dragId) return;
    if (placing) {
      const p = xy(e);
      if (!p) return;
      const nn: MapNode = { id: gid(), x: p.x, y: p.y, name: `Position ${nodes.length + 1}`, equipment: [] };
      setNodes(prev => [...prev, nn]);
      setPlacing(false);
      setEditNode(nn.id);
      return;
    }
    setSelNode(null);
    setEditNode(null);
  };

  const onDown = (e: React.MouseEvent) => {
    if (!drawMode) return;
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
    if (drawing && stroke && stroke.length > 2) setDraws(prev => [...prev, { id: gid(), points: stroke }]);
    setDrawing(false);
    setStroke(null);
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

    // Simulated AI response based on context
    const ctx = buildCtx(nodes, log, hours);
    setTimeout(() => {
      setChat(prev => [...prev, {
        role: "assistant",
        text: `Based on the current ${hours}hr operational window:\n\nTotal fuel requirement: ${log.totalFuel.toLocaleString()} gallons\nHEMTT sorties needed: ${log.totalHemtt}\nTotal personnel: ${log.totalCrew}\n\nNote: AI chat requires backend integration. Connect to Lovable Cloud to enable full AI analysis.`,
      }]);
      setChatLoad(false);
    }, 800);
  };

  const editData = nodes.find(n => n.id === editNode);
  const grid = Array.from({ length: 60 }, (_, i) => i * 20);

  return (
    <div className="w-full h-screen flex flex-col bg-background font-mono text-foreground overflow-hidden text-[11px]">
      {/* TOP BAR */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-primary font-extrabold text-sm tracking-[3px]">⬡ TACLOG</span>
          <span className="text-muted-foreground text-[9px] tracking-[1px]">v0.2</span>
        </div>
        <div className="flex gap-1 items-center">
          <button
            onClick={() => { setPlacing(true); setDrawMode(false); }}
            className="px-2.5 py-1 text-[10px] font-mono border cursor-pointer transition-colors"
            style={{
              background: placing ? 'hsl(var(--primary) / 0.1)' : 'transparent',
              borderColor: placing ? 'hsl(var(--primary) / 0.5)' : 'hsl(var(--border))',
              color: placing ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
            }}
          >
            ⊕ Location
          </button>
          <button
            onClick={() => { setDrawMode(!drawMode); setPlacing(false); }}
            className="px-2.5 py-1 text-[10px] font-mono border cursor-pointer transition-colors"
            style={{
              background: drawMode ? 'hsl(var(--tac-purple) / 0.1)' : 'transparent',
              borderColor: drawMode ? 'hsl(var(--tac-purple) / 0.5)' : 'hsl(var(--border))',
              color: drawMode ? 'hsl(var(--tac-purple))' : 'hsl(var(--muted-foreground))',
            }}
          >
            ✎ Draw
          </button>
          {draws.length > 0 && (
            <button
              onClick={() => setDraws([])}
              className="px-2 py-1 bg-transparent border border-border text-muted-foreground cursor-pointer text-[9px] font-mono"
            >
              Clear
            </button>
          )}
          <div className="w-px h-3.5 bg-border mx-1.5" />
          <span className="text-muted-foreground text-[9px]">MISSION</span>
          <input
            type="range"
            min={1}
            max={72}
            value={hours}
            onChange={e => setHours(+e.target.value)}
            className="w-[70px]"
            style={{ accentColor: 'hsl(var(--primary))' }}
          />
          <span className="text-primary font-bold text-xs min-w-[28px]">{hours}h</span>
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
            style={{ cursor: placing ? "cell" : drawMode ? "crosshair" : "default" }}
            onClick={onMapClick}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
          >
            {grid.map(p => (
              <g key={p}>
                <line x1={p} y1={0} x2={p} y2={2000} stroke="hsl(var(--tac-grid))" strokeWidth={0.5} />
                <line x1={0} y1={p} x2={2000} y2={p} stroke="hsl(var(--tac-grid))" strokeWidth={0.5} />
              </g>
            ))}

            {/* Terrain features */}
            <ellipse cx={360} cy={210} rx={65} ry={35} fill="hsl(var(--primary) / 0.05)" stroke="hsl(var(--primary) / 0.12)" strokeWidth={0.7} />
            <text x={360} y={214} fill="hsl(var(--primary) / 0.15)" fontSize={7} textAnchor="middle" fontFamily="monospace">HILL 204</text>
            <rect x={440} y={260} width={130} height={12} fill="hsl(var(--tac-blue) / 0.05)" rx={6} stroke="hsl(var(--tac-blue) / 0.1)" strokeWidth={0.7} />
            <text x={505} y={270} fill="hsl(var(--tac-blue) / 0.12)" fontSize={7} textAnchor="middle" fontFamily="monospace">── RIVER ──</text>

            {/* Drawings */}
            {draws.map(d => (
              <polyline key={d.id} points={d.points.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="hsl(var(--tac-purple))" strokeWidth={2} strokeLinecap="round" opacity={0.55} />
            ))}
            {stroke && (
              <polyline points={stroke.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="hsl(var(--tac-purple))" strokeWidth={2} strokeLinecap="round" opacity={0.35} />
            )}

            {/* Distance lines */}
            {selNode && nodes.filter(n => n.id !== selNode).map(n => {
              const s = nodes.find(x => x.id === selNode);
              if (!s) return null;
              const d = px2mi(dist(s, n)).toFixed(1);
              const mx = (s.x + n.x) / 2, my = (s.y + n.y) / 2;
              return (
                <g key={n.id}>
                  <line x1={s.x} y1={s.y} x2={n.x} y2={n.y} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="5,4" />
                  <rect x={mx - 18} y={my - 7} width={36} height={12} fill="hsl(var(--background))" rx={2} stroke="hsl(var(--border))" strokeWidth={0.5} />
                  <text x={mx} y={my + 2} fill="hsl(var(--secondary-foreground))" fontSize={8} textAnchor="middle" fontFamily="monospace">{d}mi</text>
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const isSel = selNode === node.id;
              const cnt = node.equipment.reduce((s, e) => s + e.count, 0);
              const nl = log.nodes.find(r => r.nodeId === node.id);
              return (
                <g key={node.id} onMouseDown={e => onNodeDrag(e, node.id)} onClick={e => onNodeClick(e, node.id)} style={{ cursor: drawMode ? "crosshair" : "pointer" }}>
                  {isSel && (
                    <circle cx={node.x} cy={node.y} r={30} fill="none" stroke="hsl(var(--primary))" strokeWidth={1} opacity={0.25} strokeDasharray="3,3">
                      <animate attributeName="r" values="28;34;28" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle cx={node.x} cy={node.y} r={18} fill="hsl(var(--card))" stroke={isSel ? "hsl(var(--primary))" : "hsl(var(--border))"} strokeWidth={isSel ? 2 : 1.2} />
                  <circle cx={node.x} cy={node.y} r={2.5} fill={cnt > 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} />
                  <text x={node.x} y={node.y + 28} fill={isSel ? "hsl(var(--primary))" : "hsl(var(--secondary-foreground))"} fontSize={9} textAnchor="middle" fontWeight={600} fontFamily="monospace">{node.name}</text>
                  {cnt > 0 && (
                    <>
                      <rect x={node.x + 10} y={node.y - 22} width={16} height={12} fill="hsl(var(--card))" stroke="hsl(var(--primary) / 0.3)" strokeWidth={0.7} rx={2} />
                      <text x={node.x + 18} y={node.y - 13} fill="hsl(var(--primary))" fontSize={8} textAnchor="middle" fontFamily="monospace">{cnt}</text>
                    </>
                  )}
                  {nl && nl.totalFuel > 0 && (
                    <text x={node.x} y={node.y + 38} fill="hsl(var(--muted-foreground))" fontSize={7} textAnchor="middle" fontFamily="monospace">{nl.totalFuel.toLocaleString()}g</text>
                  )}
                </g>
              );
            })}

            {/* Scale bar */}
            <g transform="translate(14,14)">
              <line x1={0} y1={0} x2={67} y2={0} stroke="hsl(var(--border))" strokeWidth={1} />
              <line x1={0} y1={-3} x2={0} y2={3} stroke="hsl(var(--border))" />
              <line x1={67} y1={-3} x2={67} y2={3} stroke="hsl(var(--border))" />
              <text x={33} y={-5} fill="hsl(var(--border))" fontSize={7} textAnchor="middle" fontFamily="monospace">10 mi</text>
            </g>
          </svg>

          {/* Manifest Editor Overlay */}
          {editData && (
            <div className="absolute top-2.5 left-2.5 z-20">
              <ManifestEditor
                node={editData}
                onUpdate={updateNode}
                onClose={() => setEditNode(null)}
                onRemove={() => removeNode(editData.id)}
              />
            </div>
          )}

          {/* Status bar */}
          <div className="absolute bottom-2 left-2 bg-card/90 border border-border px-2 py-1 text-[9px] text-muted-foreground">
            {placing ? (
              <span className="text-primary">Click map to place</span>
            ) : drawMode ? (
              <span className="text-tac-purple">Draw mode</span>
            ) : (
              <span>Click location to edit · Drag to move</span>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-[290px] bg-card border-l border-border flex flex-col shrink-0">
          <div className="flex border-b border-border">
            {(["logistics", "chat"] as const).map(t => (
              <button
                key={t}
                onClick={() => setRightTab(t)}
                className="flex-1 py-2 border-0 cursor-pointer text-[10px] uppercase tracking-[1.5px] font-mono transition-colors"
                style={{
                  background: rightTab === t ? 'hsl(var(--secondary))' : 'transparent',
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

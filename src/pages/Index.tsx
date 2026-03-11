import { useState, useRef, useEffect, useCallback } from “react”;
import {
DEFAULT_EQUIPMENT, computeLog, buildCtx, gid, haversineMi,
type MapNode, type ChatMessage, type LogisticsResult, type EquipmentDB,
} from “@/lib/taclog-data”;
import { EQUIPMENT_DB } from “@/lib/equipment-db”;
import { computeRouteAnalysis, buildRouteCtx, type RouteAnalysis } from “@/lib/route-analysis”;
import type { BriefingData } from “@/lib/briefing-types”;
import ManifestEditor from “@/components/taclog/ManifestEditor”;
import LogisticsPanel from “@/components/taclog/LogisticsPanel”;
import ChatPanel from “@/components/taclog/ChatPanel”;
import MapboxMap from “@/components/taclog/MapboxMap”;
import RouteAnalysisCard from “@/components/taclog/RouteAnalysisCard”;
import BriefingOverlay from “@/components/taclog/BriefingOverlay”;
import QuickStartCard from “@/components/taclog/QuickStartCard”;
import { useUndo } from “@/hooks/use-undo”;

const EXAMPLE_NODES: MapNode[] = [
{ id: “ex1”, lng: -79.01, lat: 35.14, name: “FOB Alpha”, shape: “point”, equipment: [
{ tid: “m1a2sep”, count: 4, fuelPct: 85 },
{ tid: “m2a3”, count: 6, fuelPct: 70 },
{ tid: “hemtt_tanker”, count: 2, fuelPct: 100 },
]},
{ id: “ex2”, lng: -78.94, lat: 35.20, name: “LZ Bravo”, shape: “point”, equipment: [
{ tid: “uh60m”, count: 3, fuelPct: 60 },
{ tid: “ah64d”, count: 2, fuelPct: 75 },
]},
{ id: “ex3”, lng: -79.08, lat: 35.08, name: “FSB Charlie”, shape: “point”, equipment: [
{ tid: “m109a7”, count: 4, fuelPct: 90 },
{ tid: “fmtv_cargo”, count: 3, fuelPct: 80 },
{ tid: “hmmwv”, count: 6, fuelPct: 95 },
]},
{ id: “ex4”, lng: -78.88, lat: 35.12, name: “MSR Delta Supply Point”, shape: “point”, equipment: [
{ tid: “hemtt_cargo”, count: 4, fuelPct: 100 },
{ tid: “pls”, count: 2, fuelPct: 90 },
{ tid: “lmtv”, count: 3, fuelPct: 85 },
]},
];

const MAP_VIEW_KEY = “taclog_map_view”;

function loadMapView(): { center: [number, number]; zoom: number } | null {
try {
const v = localStorage.getItem(MAP_VIEW_KEY);
return v ? JSON.parse(v) : null;
} catch { return null; }
}

export function saveMapView(center: [number, number], zoom: number) {
try {
localStorage.setItem(MAP_VIEW_KEY, JSON.stringify({ center, zoom }));
} catch { /* */ }
}

export default function Index() {
const [eqDb, setEqDb] = useState<EquipmentDB>(() => {
const db: EquipmentDB = { ...DEFAULT_EQUIPMENT };
EQUIPMENT_DB.forEach(eq => {
db[eq.id] = { name: eq.name, cat: eq.cat, fuelBurn: eq.fuelBurnMoving, fuelCap: eq.fuelCap, speed: eq.speed, crew: eq.crew };
});
return db;
});

const { state: nodes, set: setNodes, undo, redo, canUndo, canRedo } = useUndo<MapNode[]>([]);
const [selNode, setSelNode] = useState<string | null>(null);
const [editNode, setEditNode] = useState<string | null>(null);
const [hours, setHours] = useState(24);
const [chat, setChat] = useState<ChatMessage[]>([
{ role: “system”, text: “TACLOG AI ready. I see your battlefield. Load equipment into locations and ask me about fuel, resupply, movement costs, or mission planning.” },
]);
const [chatIn, setChatIn] = useState(””);
const [chatLoad, setChatLoad] = useState(false);
const [rightTab, setRightTab] = useState<“logistics” | “chat”>(“logistics”);
const [rightPanelOpen, setRightPanelOpen] = useState(false);
const [drawMode, setDrawMode] = useState(false);
const [addLocationMode, setAddLocationMode] = useState(false);
const [pendingName, setPendingName] = useState<{ id: string } | null>(null);
const [shapeName, setShapeName] = useState(””);
const [mgrsCoord, setMgrsCoord] = useState(””);
const nameInput = useRef<HTMLInputElement>(null);

const [routeMode, setRouteMode] = useState(false);
const [routeStart, setRouteStart] = useState<string | null>(null);
const [routeAnalysis, setRouteAnalysis] = useState<RouteAnalysis | null>(null);

const [briefing, setBriefing] = useState<BriefingData | null>(null);
const [briefingOpen, setBriefingOpen] = useState(false);
const [briefingLoading, setBriefingLoading] = useState(false);

const savedMapView = useRef(loadMapView());

useEffect(() => { if (pendingName && nameInput.current) nameInput.current.focus(); }, [pendingName]);

const log = computeLog(nodes, eqDb, hours);
const totalVehicles = nodes.reduce((s, n) => s + n.equipment.reduce((ss, e) => ss + e.count, 0), 0);
const locationNames = nodes.map(n => n.name);

const addEquipType = (eq: { name: string; cat: string; fuelBurn: number; fuelCap: number; speed: number; crew: number }) => {
const id = eq.name.toLowerCase().replace(/[^a-z0-9]/g, “*”) + “*” + gid().substr(0, 4);
setEqDb(prev => ({ …prev, [id]: { …eq } }));
};

const loadExample = useCallback(() => {
setNodes(EXAMPLE_NODES);
setSelNode(null);
setEditNode(null);
}, [setNodes]);

const onNodeClick = useCallback((id: string) => {
if (routeMode) {
if (!routeStart) {
setRouteStart(id);
} else if (id !== routeStart) {
const fromNode = nodes.find(n => n.id === routeStart);
const toNode = nodes.find(n => n.id === id);
if (fromNode && toNode) {
setRouteAnalysis(computeRouteAnalysis(fromNode, toNode, eqDb));
}
setRouteMode(false);
setRouteStart(null);
}
return;
}
setSelNode(id);
setEditNode(id);
}, [routeMode, routeStart, nodes, eqDb]);

const onNodeDrag = useCallback((id: string, lng: number, lat: number) => {
setNodes(prev => prev.map(n => n.id === id ? { ...n, lng, lat } : n));
}, [setNodes]);

const onAddNode = useCallback((lng: number, lat: number, shape: “point” | “circle” | “rect”, shapeData?: MapNode[“shapeData”]) => {
const newNode: MapNode = {
id: gid(), lng, lat,
name: `Position ${Date.now() % 1000}`,
shape, shapeData, equipment: [],
};
setNodes(prev => [...prev, newNode]);
setSelNode(newNode.id);
setEditNode(newNode.id);
setPendingName({ id: newNode.id });
setShapeName(””);
setAddLocationMode(false);
setDrawMode(false);
}, [setNodes]);

const onDeselectNode = useCallback(() => {
if (routeMode) return;
setSelNode(null);
setEditNode(null);
}, [routeMode]);

const confirmName = () => {
if (!pendingName) return;
const name = shapeName.trim();
if (name) setNodes(prev => prev.map(n => n.id === pendingName.id ? { ...n, name } : n));
setPendingName(null);
setShapeName(””);
};

const updateNode = (u: MapNode) => setNodes(prev => prev.map(n => n.id === u.id ? u : n));
const removeNode = (id: string) => {
setNodes(prev => prev.filter(n => n.id !== id));
if (editNode === id) setEditNode(null);
if (selNode === id) setSelNode(null);
};

const toggleRouteMode = () => {
const next = !routeMode;
setRouteMode(next);
setRouteStart(null);
setRouteAnalysis(null);
if (next) { setAddLocationMode(false); setDrawMode(false); setEditNode(null); }
};

const onFlyToNode = useCallback((nodeId: string) => {
const node = nodes.find(n => n.id === nodeId);
if (node && (window as any).__taclogFlyTo) {
(window as any).__taclogFlyTo(node.lng, node.lat);
}
}, [nodes]);

const onFlyToLocationByName = useCallback((name: string) => {
const node = nodes.find(n => n.name.toLowerCase() === name.toLowerCase());
if (node && (window as any).__taclogFlyTo) {
(window as any).__taclogFlyTo(node.lng, node.lat);
setSelNode(node.id);
setEditNode(node.id);
}
}, [nodes]);

const generateBriefing = async () => {
if (briefingLoading) return;
setBriefingLoading(true);
const ctx = buildCtx(nodes, eqDb, log, hours);
try {
const resp = await fetch(
`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/taclog-chat`,
{
method: “POST”,
headers: {
“Content-Type”: “application/json”,
Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
},
body: JSON.stringify({ mode: “briefing”, context: ctx }),
}
);
if (!resp.ok) {
const err = await resp.json().catch(() => ({ error: “Unknown error” }));
throw new Error(err.error || `HTTP ${resp.status}`);
}
const data = await resp.json();
if (data.briefing) {
setBriefing({
...data.briefing,
generatedAt: new Date().toLocaleString(“en-US”, { dateStyle: “medium”, timeStyle: “short” }),
});
setBriefingOpen(true);
}
} catch (e) {
console.error(“Briefing error:”, e);
setChat(prev => […prev, { role: “system”, text: `Briefing failed: ${e instanceof Error ? e.message : "Unknown error"}` }]);
} finally {
setBriefingLoading(false);
}
};

const sendChat = async (directMsg?: string) => {
const msg = (directMsg || chatIn).trim();
if (!msg || chatLoad) return;
setChatIn(””);
const userMsg: ChatMessage = { role: “user”, text: msg };
setChat(prev => [...prev, userMsg]);
setChatLoad(true);
let ctx = buildCtx(nodes, eqDb, log, hours);
if (routeAnalysis) ctx += buildRouteCtx(routeAnalysis);
const apiMessages = […chat.filter(m => m.role !== “system”), userMsg];
try {
const resp = await fetch(
`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/taclog-chat`,
{
method: “POST”,
headers: { “Content-Type”: “application/json”, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
body: JSON.stringify({ messages: apiMessages, context: ctx }),
}
);
if (!resp.ok) {
const err = await resp.json().catch(() => ({ error: “Unknown error” }));
throw new Error(err.error || `HTTP ${resp.status}`);
}
const reader = resp.body!.getReader();
const decoder = new TextDecoder();
let buffer = “”;
let assistantText = “”;
while (true) {
const { done, value } = await reader.read();
if (done) break;
buffer += decoder.decode(value, { stream: true });
let newlineIdx: number;
while ((newlineIdx = buffer.indexOf(”\n”)) !== -1) {
let line = buffer.slice(0, newlineIdx);
buffer = buffer.slice(newlineIdx + 1);
if (line.endsWith(”\r”)) line = line.slice(0, -1);
if (!line.startsWith(“data: “) || line.trim() === “”) continue;
const jsonStr = line.slice(6).trim();
if (jsonStr === “[DONE]”) break;
try {
const parsed = JSON.parse(jsonStr);
const delta = parsed.delta?.text || parsed.choices?.[0]?.delta?.content;
if (delta) {
assistantText += delta;
const text = assistantText;
setChat(prev => {
const last = prev[prev.length - 1];
if (last?.role === “assistant”) return prev.map((m, i) => i === prev.length - 1 ? { …m, text } : m);
return […prev, { role: “assistant”, text }];
});
}
} catch { /* partial JSON */ }
}
}
} catch (e) {
console.error(“Chat error:”, e);
setChat(prev => […prev, { role: “system”, text: `Error: ${e instanceof Error ? e.message : "Failed to reach AI"}` }]);
} finally {
setChatLoad(false);
}
};

const editData = nodes.find(n => n.id === editNode);
const routeLine: [number, number, number, number] | null =
routeAnalysis ? [routeAnalysis.from.lng, routeAnalysis.from.lat, routeAnalysis.to.lng, routeAnalysis.to.lat] : null;
const showQuickStart = nodes.length === 0 && !addLocationMode && !drawMode;

// Close manifest editor when clicking the same node or deselecting
const closeManifest = () => setEditNode(null);

return (
<div className="w-full h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden text-xs">
{/* TOOLBAR — wraps on smaller screens */}
<div className="flex flex-wrap items-center justify-between gap-1 px-2 py-1.5 bg-card border-b border-border/50 shrink-0 panel-shadow relative z-30">
{/* Left: Logo */}
<div className="flex items-center gap-2 mr-auto">
<span className="text-primary font-medium text-[14px] tracking-[2px]">⬡ TACLOG</span>
</div>

    {/* Center: Action buttons — wrap on small screens */}
    <div className="flex flex-wrap gap-1 items-center order-3 w-full sm:w-auto sm:order-2 mt-1 sm:mt-0">
      <button
        onClick={undo} disabled={!canUndo}
        className="px-2 py-1.5 text-[10px] border cursor-pointer rounded disabled:opacity-30"
        style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
      >↩</button>
      <button
        onClick={redo} disabled={!canRedo}
        className="px-2 py-1.5 text-[10px] border cursor-pointer rounded disabled:opacity-30"
        style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
      >↪</button>

      <button
        onClick={() => { setAddLocationMode(!addLocationMode); setDrawMode(false); setRouteMode(false); setRouteStart(null); }}
        className="px-2.5 py-1.5 text-[10px] border cursor-pointer rounded transition-all"
        style={{
          background: addLocationMode ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--card))',
          borderColor: addLocationMode ? 'hsl(var(--primary))' : 'hsl(var(--border))',
          color: addLocationMode ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
          fontWeight: addLocationMode ? 500 : 400,
        }}
      >
        ⊕ {addLocationMode ? "Placing..." : "Add"}
      </button>
      <button
        onClick={() => { setDrawMode(!drawMode); setAddLocationMode(false); setRouteMode(false); setRouteStart(null); }}
        className="px-2.5 py-1.5 text-[10px] border cursor-pointer rounded transition-all"
        style={{
          background: drawMode ? 'hsl(var(--tac-blue) / 0.1)' : 'hsl(var(--card))',
          borderColor: drawMode ? 'hsl(var(--tac-blue))' : 'hsl(var(--border))',
          color: drawMode ? 'hsl(var(--tac-blue))' : 'hsl(var(--muted-foreground))',
          fontWeight: drawMode ? 500 : 400,
        }}
      >
        ✎ {drawMode ? "Drawing" : "Draw"}
      </button>
      <button
        onClick={toggleRouteMode}
        className="px-2.5 py-1.5 text-[10px] border cursor-pointer rounded transition-all"
        style={{
          background: routeMode ? 'hsl(var(--tac-amber) / 0.12)' : 'hsl(var(--card))',
          borderColor: routeMode ? 'hsl(var(--tac-amber))' : 'hsl(var(--border))',
          color: routeMode ? 'hsl(var(--tac-amber))' : 'hsl(var(--muted-foreground))',
          fontWeight: routeMode ? 500 : 400,
        }}
      >
        ↗ {routeMode ? (routeStart ? "Dest" : "Start") : "Route"}
      </button>

      <button
        onClick={() => briefing ? setBriefingOpen(true) : generateBriefing()}
        disabled={briefingLoading}
        className="px-2.5 py-1.5 text-[10px] border-0 cursor-pointer rounded font-medium"
        style={{
          background: briefingLoading ? 'hsl(var(--muted))' : 'hsl(var(--primary))',
          color: briefingLoading ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))',
        }}
      >
        {briefingLoading ? "⏳..." : briefing ? "📋 Brief" : "📋 Brief"}
      </button>
    </div>

    {/* Right: Mission slider + Panel toggle */}
    <div className="flex items-center gap-1.5 order-2 sm:order-3">
      <span className="text-muted-foreground text-[9px] hidden sm:inline">Mission</span>
      <input
        type="range" min={1} max={72} value={hours}
        onChange={e => setHours(+e.target.value)}
        className="w-14 sm:w-16"
        style={{ accentColor: 'hsl(var(--primary))' }}
      />
      <span className="text-primary font-medium text-[12px] min-w-[28px]">{hours}h</span>

      {/* Panel toggle button */}
      <button
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
        className="px-2.5 py-1.5 text-[10px] border cursor-pointer rounded transition-all ml-1"
        style={{
          background: rightPanelOpen ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--card))',
          borderColor: rightPanelOpen ? 'hsl(var(--primary))' : 'hsl(var(--border))',
          color: rightPanelOpen ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
        }}
      >
        {rightPanelOpen ? "✕ Panel" : "☰ Panel"}
      </button>
    </div>
  </div>

  {/* MAIN CONTENT */}
  <div className="flex flex-1 overflow-hidden relative">
    {/* MANIFEST EDITOR — overlays map on all screen sizes */}
    {editData && !pendingName && !routeMode && (
      <div className="absolute left-0 top-0 bottom-0 z-20 w-[280px] max-w-[85vw]">
        <ManifestEditor
          node={editData}
          eqDb={eqDb}
          onUpdate={updateNode}
          onClose={closeManifest}
          onRemove={() => removeNode(editData.id)}
          onAddEquipType={addEquipType}
        />
      </div>
    )}

    {/* MAP — always full width */}
    <div className="flex-1 relative overflow-hidden">
      <MapboxMap
        nodes={nodes}
        selNode={selNode}
        log={log}
        drawMode={drawMode}
        eqDb={eqDb}
        addLocationMode={addLocationMode}
        routeMode={routeMode}
        routeStart={routeStart}
        routeLine={routeLine}
        mgrsCoord={mgrsCoord}
        onMgrsChange={setMgrsCoord}
        totalLocations={nodes.length}
        totalVehicles={totalVehicles}
        totalFuel={log.fuel}
        hours={hours}
        onNodeClick={onNodeClick}
        onNodeDrag={onNodeDrag}
        onAddNode={onAddNode}
        onDeselectNode={onDeselectNode}
        initialView={savedMapView.current}
        onViewChange={saveMapView}
      />

      {/* Quick start card */}
      {showQuickStart && (
        <QuickStartCard
          onAddLocation={() => { setAddLocationMode(true); setDrawMode(false); }}
          onDrawShape={() => { setDrawMode(true); setAddLocationMode(false); }}
          onLoadExample={loadExample}
        />
      )}

      {/* Naming dialog */}
      {pendingName && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-lg p-4 w-[240px] panel-shadow z-30">
          <div className="text-[11px] font-medium text-primary mb-2">Name this location:</div>
          <input
            ref={nameInput}
            value={shapeName}
            onChange={e => setShapeName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && confirmName()}
            placeholder="e.g. FOB Delta, LZ Hawk..."
            className="w-full p-2 border border-border rounded text-xs outline-none mb-2.5 bg-background"
          />
          <div className="flex gap-2">
            <button onClick={confirmName} className="flex-1 p-2 bg-primary border-none text-primary-foreground rounded cursor-pointer font-medium text-[11px]">Confirm</button>
            <button onClick={() => setPendingName(null)} className="px-3 p-2 bg-card border border-border text-secondary-foreground rounded cursor-pointer text-[11px]">Skip</button>
          </div>
        </div>
      )}

      {/* Route analysis card */}
      {routeAnalysis && (
        <div className="absolute top-2.5 left-2.5 z-20 max-w-[90vw]">
          <RouteAnalysisCard analysis={routeAnalysis} onClose={() => setRouteAnalysis(null)} />
        </div>
      )}
    </div>

    {/* RIGHT PANEL — slides in from right, overlays map */}
    {rightPanelOpen && (
      <>
        {/* Backdrop — tap to close on mobile/tablet */}
        <div
          className="absolute inset-0 z-15 bg-foreground/10 sm:hidden"
          onClick={() => setRightPanelOpen(false)}
        />
        <div className="absolute right-0 top-0 bottom-0 z-20 w-[300px] max-w-[85vw] bg-card flex flex-col panel-shadow animate-slide-in-right">
          {/* Close button for the panel */}
          <div className="flex items-center justify-between px-2.5 py-1 border-b border-border/50">
            <div className="flex flex-1">
              {(["logistics", "chat"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setRightTab(t)}
                  className="flex-1 py-2 border-0 cursor-pointer text-[9px] uppercase tracking-[1.5px] font-medium transition-all duration-200"
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
            <button
              onClick={() => setRightPanelOpen(false)}
              className="ml-2 p-1.5 rounded hover:bg-secondary cursor-pointer border-0 bg-transparent text-muted-foreground text-sm"
            >
              ✕
            </button>
          </div>

          {rightTab === "logistics" && (
            <LogisticsPanel
              log={log}
              hours={hours}
              onSelectNode={(id) => { setSelNode(id); setEditNode(id); }}
              onFlyTo={onFlyToNode}
            />
          )}

          {rightTab === "chat" && (
            <ChatPanel
              chat={chat}
              chatIn={chatIn}
              setChatIn={setChatIn}
              chatLoad={chatLoad}
              onSend={sendChat}
              onFlyToLocation={onFlyToLocationByName}
              locationNames={locationNames}
            />
          )}
        </div>
      </>
    )}
  </div>

  {/* Briefing overlay */}
  {briefingOpen && briefing && (
    <BriefingOverlay briefing={briefing} onClose={() => setBriefingOpen(false)} />
  )}
</div>
```

);
}
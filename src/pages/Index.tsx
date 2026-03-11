import { useState, useRef, useEffect, useCallback } from "react";
import {
  DEFAULT_EQUIPMENT, computeLog, buildCtx, gid, haversineMi,
  type MapNode, type ChatMessage, type LogisticsResult, type EquipmentDB,
} from "@/lib/taclog-data";
import ManifestEditor from "@/components/taclog/ManifestEditor";
import LogisticsPanel from "@/components/taclog/LogisticsPanel";
import ChatPanel from "@/components/taclog/ChatPanel";
import MapboxMap from "@/components/taclog/MapboxMap";
import { forward as toMgrs } from "mgrs";

const INITIAL_NODES: MapNode[] = [
  { id: "n1", lng: -79.01, lat: 35.14, name: "FOB Alpha", shape: "point", equipment: [] },
  { id: "n2", lng: -78.94, lat: 35.20, name: "LZ Bravo", shape: "point", equipment: [] },
];

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
  const [addLocationMode, setAddLocationMode] = useState(false);
  const [pendingName, setPendingName] = useState<{ id: string } | null>(null);
  const [shapeName, setShapeName] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => { if (pendingName && nameInput.current) nameInput.current.focus(); }, [pendingName]);

  const log = computeLog(nodes, eqDb, hours);

  const addEquipType = (eq: { name: string; cat: string; fuelBurn: number; fuelCap: number; speed: number; crew: number }) => {
    const id = eq.name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + gid().substr(0, 4);
    setEqDb(prev => ({ ...prev, [id]: { ...eq } }));
  };

  const onNodeClick = useCallback((id: string) => {
    setSelNode(id);
    setEditNode(id);
  }, []);

  const onNodeDrag = useCallback((id: string, lng: number, lat: number) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, lng, lat } : n));
  }, []);

  const onAddNode = useCallback((lng: number, lat: number, shape: "point" | "circle" | "rect", shapeData?: MapNode["shapeData"]) => {
    const newNode: MapNode = {
      id: gid(), lng, lat,
      name: `Position ${Date.now() % 1000}`,
      shape,
      shapeData,
      equipment: [],
    };
    setNodes(prev => [...prev, newNode]);
    setSelNode(newNode.id);
    setEditNode(newNode.id);
    setPendingName({ id: newNode.id });
    setShapeName("");
    setAddLocationMode(false);
    setDrawMode(false);
  }, []);

  const onDeselectNode = useCallback(() => {
    setSelNode(null);
    setEditNode(null);
  }, []);

  const confirmName = () => {
    if (!pendingName) return;
    const name = shapeName.trim();
    if (name) {
      setNodes(prev => prev.map(n => n.id === pendingName.id ? { ...n, name } : n));
    }
    setPendingName(null);
    setShapeName("");
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
    const userMsg: ChatMessage = { role: "user", text: msg };
    setChat(prev => [...prev, userMsg]);
    setChatLoad(true);

    const ctx = buildCtx(nodes, eqDb, log, hours);
    // Filter to only user/assistant messages for the API
    const apiMessages = [...chat.filter(m => m.role !== "system"), userMsg];

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/taclog-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: apiMessages, context: ctx }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ") || line.trim() === "") continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.delta?.text || parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              const text = assistantText;
              setChat(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, text } : m);
                }
                return [...prev, { role: "assistant", text }];
              });
            }
          } catch {
            // partial JSON, ignore
          }
        }
      }
    } catch (e) {
      console.error("Chat error:", e);
      setChat(prev => [...prev, {
        role: "system",
        text: `Error: ${e instanceof Error ? e.message : "Failed to reach AI"}. Check your API key configuration.`,
      }]);
    } finally {
      setChatLoad(false);
    }
  };

  const editData = nodes.find(n => n.id === editNode);

  // Get MGRS for selected node
  let editMgrs = "";
  if (editData) {
    try { editMgrs = toMgrs([editData.lng, editData.lat], 5); } catch { editMgrs = ""; }
  }

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
            onClick={() => { setAddLocationMode(!addLocationMode); setDrawMode(false); }}
            className="px-3.5 py-1.5 text-[11px] font-mono border cursor-pointer rounded transition-colors"
            style={{
              background: addLocationMode ? 'hsl(var(--primary) / 0.1)' : 'white',
              borderColor: addLocationMode ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              color: addLocationMode ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              fontWeight: addLocationMode ? 600 : 400,
            }}
          >
            {addLocationMode ? "⊕ Click map to place" : "⊕ Add Location"}
          </button>
          <button
            onClick={() => { setDrawMode(!drawMode); setAddLocationMode(false); }}
            className="px-3.5 py-1.5 text-[11px] font-mono border cursor-pointer rounded transition-colors"
            style={{
              background: drawMode ? 'hsl(var(--tac-blue) / 0.1)' : 'white',
              borderColor: drawMode ? 'hsl(var(--tac-blue))' : 'hsl(var(--border))',
              color: drawMode ? 'hsl(var(--tac-blue))' : 'hsl(var(--muted-foreground))',
              fontWeight: drawMode ? 600 : 400,
            }}
          >
            {drawMode ? "✎ Drawing — draw a shape" : "✎ Draw Shape"}
          </button>
          <div className="w-px h-[18px] bg-border mx-1" />
          <span className="text-muted-foreground text-[10px]">Mission:</span>
          <input
            type="range" min={1} max={72} value={hours}
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
          <MapboxMap
            nodes={nodes}
            selNode={selNode}
            log={log}
            drawMode={drawMode}
            addLocationMode={addLocationMode}
            onNodeClick={onNodeClick}
            onNodeDrag={onNodeDrag}
            onAddNode={onAddNode}
            onDeselectNode={onDeselectNode}
          />

          {/* Naming dialog for new location */}
          {pendingName && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-tac-info rounded-lg p-3.5 w-[220px] shadow-lg z-30">
              <div className="text-[11px] font-semibold text-tac-info mb-1.5">
                Name this location:
              </div>
              <input
                ref={nameInput}
                value={shapeName}
                onChange={e => setShapeName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmName()}
                placeholder="e.g. FOB Delta, LZ Hawk..."
                className="w-full p-1.5 border border-border rounded font-mono text-xs outline-none mb-2"
              />
              <div className="flex gap-1.5">
                <button onClick={confirmName} className="flex-1 p-1.5 bg-tac-info border-none text-white rounded cursor-pointer font-mono font-semibold text-[11px]">Confirm</button>
                <button onClick={() => setPendingName(null)} className="px-2.5 p-1.5 bg-white border border-border text-secondary-foreground rounded cursor-pointer font-mono text-[11px]">Skip</button>
              </div>
            </div>
          )}

          {/* Editor overlay */}
          {editData && !pendingName && (
            <div className="absolute top-2.5 left-2.5 z-20">
              {editMgrs && (
                <div className="bg-card/90 border border-border rounded px-2 py-0.5 mb-1 text-[9px] text-muted-foreground font-mono">
                  MGRS: <span className="text-primary font-semibold">{editMgrs}</span>
                </div>
              )}
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

import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { forward as toMgrs } from "mgrs";
import {
  gid, haversineMi, haversineKm,
  type MapNode, type LogisticsResult,
} from "@/lib/taclog-data";
import { EQUIPMENT_DB } from "@/lib/equipment-db";

// Use env variable ONLY — no hardcoded fallback token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

const STYLES = [
  { id: "mapbox://styles/mapbox/outdoors-v12", label: "Terrain" },
  { id: "mapbox://styles/mapbox/satellite-streets-v12", label: "Satellite" },
  { id: "mapbox://styles/mapbox/dark-v11", label: "Dark" },
];

const CAT_ICONS: Record<string, string> = {
  "Rotary Wing": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h8m4 0h8M12 2v4m0 12v4"/><circle cx="12" cy="12" r="3"/></svg>`,
  "Armor": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="10" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M12 8V4l4 4"/></svg>`,
  "IFV/APC": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="8" width="20" height="9" rx="2"/><circle cx="6" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><circle cx="12" cy="17" r="2"/></svg>`,
  "Logistics": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="15" height="10" rx="1"/><path d="M16 10h4l3 4v2h-7V10z"/><circle cx="6" cy="18" r="2"/><circle cx="20" cy="18" r="2"/></svg>`,
  "Artillery": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L8 12h8L12 2z"/><rect x="6" y="12" width="12" height="6" rx="1"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/></svg>`,
  "Wheeled": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="16" height="8" rx="2"/><circle cx="6" cy="17" r="2"/><circle cx="14" cy="17" r="2"/><path d="M18 10h3l2 3v2h-5V10z"/></svg>`,
  "UAS": `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12L4 6m8 6l8-6m-8 6v8M8 8h8"/></svg>`,
};

const DEFAULT_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/></svg>`;

interface MapboxMapProps {
  nodes: MapNode[];
  selNode: string | null;
  log: LogisticsResult;
  drawMode: boolean;
  eqDb: Record<string, { cat: string; [k: string]: any }>;
  onNodeClick: (id: string) => void;
  onNodeDrag: (id: string, lng: number, lat: number) => void;
  onAddNode: (lng: number, lat: number, shape: "point" | "circle" | "rect", shapeData?: MapNode["shapeData"]) => void;
  onDeselectNode: () => void;
  addLocationMode: boolean;
  routeMode?: boolean;
  routeStart?: string | null;
  routeLine?: [number, number, number, number] | null;
  mgrsCoord: string;
  onMgrsChange: (mgrs: string) => void;
  totalLocations: number;
  totalVehicles: number;
  totalFuel: number;
  hours: number;
  initialView?: { center: [number, number]; zoom: number } | null;
  onViewChange?: (center: [number, number], zoom: number) => void;
}

export default function MapboxMap({
  nodes, selNode, log, drawMode, eqDb, onNodeClick, onNodeDrag, onAddNode, onDeselectNode, addLocationMode,
  routeMode, routeStart, routeLine, mgrsCoord, onMgrsChange, totalLocations, totalVehicles, totalFuel, hours,
  initialView, onViewChange,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const distMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const distLinesSourceAdded = useRef(false);
  const [styleIdx, setStyleIdx] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [strokePoints, setStrokePoints] = useState<{ x: number; y: number }[]>([]);
  const canvasOverlayRef = useRef<HTMLCanvasElement>(null);

  // Expose flyTo
  const flyTo = useCallback((lng: number, lat: number) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 12, duration: 800 });
  }, []);

  useEffect(() => {
    (window as any).__taclogFlyTo = flyTo;
    return () => { delete (window as any).__taclogFlyTo; };
  }, [flyTo]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLES[0].id,
      center: initialView?.center || [-79.0, 35.14],
      zoom: initialView?.zoom || 10,
      pitchWithRotate: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ unit: "imperial" }), "bottom-left");

    map.on("load", () => {
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
      }
    });

    map.on("mousemove", (e) => {
      try {
        const m = toMgrs([e.lngLat.lng, e.lngLat.lat], 5);
        onMgrsChange(m);
      } catch {
        onMgrsChange("");
      }
    });

    map.on("moveend", () => {
      const c = map.getCenter();
      onViewChange?.([c.lng, c.lat], map.getZoom());
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Handle map click
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: mapboxgl.MapMouseEvent) => {
      if (addLocationMode) {
        onAddNode(e.lngLat.lng, e.lngLat.lat, "point");
      } else if (!drawMode) {
        onDeselectNode();
      }
    };
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [addLocationMode, drawMode, onAddNode, onDeselectNode]);

  // Cursor
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvasContainer();
    canvas.style.cursor = (addLocationMode || drawMode || routeMode) ? "crosshair" : "";
  }, [addLocationMode, drawMode, routeMode]);

  // Style switching
  const switchStyle = useCallback((idx: number) => {
    const map = mapRef.current;
    if (!map) return;
    setStyleIdx(idx);
    map.setStyle(STYLES[idx].id);
    map.once("style.load", () => {
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
      }
      distLinesSourceAdded.current = false;
      addShapeLayers(map, nodes);
    });
  }, [nodes]);

  // Primary category for node
  const getPrimaryCategory = (node: MapNode): string => {
    const catCounts: Record<string, number> = {};
    node.equipment.forEach(e => {
      const dbEntry = EQUIPMENT_DB.find(eq => eq.id === e.tid);
      const legacyEntry = eqDb[e.tid];
      const cat = dbEntry?.cat || legacyEntry?.cat || "Other";
      catCounts[cat] = (catCounts[cat] || 0) + e.count;
    });
    let maxCat = "Other", maxCount = 0;
    Object.entries(catCounts).forEach(([cat, count]) => {
      if (count > maxCount) { maxCat = cat; maxCount = count; }
    });
    return maxCat;
  };

  // ── DISTANCE LABELS: Use Mapbox markers so they follow pan/zoom ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Clear old distance markers
    Object.values(distMarkersRef.current).forEach(m => m.remove());
    distMarkersRef.current = {};

    // Remove old distance line layers/sources
    const style = map.getStyle();
    if (style?.layers) {
      style.layers.forEach(l => {
        if (l.id.startsWith("taclog-dist-line-")) map.removeLayer(l.id);
      });
    }
    if (style?.sources) {
      Object.keys(style.sources).forEach(s => {
        if (s.startsWith("taclog-dist-line-")) map.removeSource(s);
      });
    }

    const selNodeData = nodes.find(n => n.id === selNode);
    if (!selNodeData) return;

    nodes.filter(n => n.id !== selNode).forEach(n => {
      const mi = haversineMi(selNodeData, n).toFixed(1);
      const km = haversineKm(selNodeData, n).toFixed(1);
      const midLng = (selNodeData.lng + n.lng) / 2;
      const midLat = (selNodeData.lat + n.lat) / 2;

      // Distance line as Mapbox layer
      const lineSrcId = `taclog-dist-line-${n.id}`;
      const lineLayerId = `taclog-dist-line-${n.id}`;
      try {
        map.addSource(lineSrcId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [[selNodeData.lng, selNodeData.lat], [n.lng, n.lat]],
            },
          },
        });
        map.addLayer({
          id: lineLayerId,
          type: "line",
          source: lineSrcId,
          paint: {
            "line-color": "#6b7280",
            "line-width": 1,
            "line-dasharray": [5, 4],
            "line-opacity": 0.5,
          },
        });
      } catch { /* layer may already exist during rapid updates */ }

      // Distance label as a Mapbox marker
      const el = document.createElement("div");
      el.style.cssText = `
        background: hsl(40,22%,95%);
        border: 1px solid hsl(40,12%,78%);
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 10px;
        font-weight: 600;
        font-family: 'DM Mono', monospace;
        color: hsl(90,8%,30%);
        pointer-events: none;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.1);
      `;
      el.textContent = `${mi}mi / ${km}km`;

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([midLng, midLat])
        .addTo(map);

      distMarkersRef.current[n.id] = marker;
    });
  }, [selNode, nodes]);

  // Sync node markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(nodes.map(n => n.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    nodes.forEach(node => {
      const cnt = node.equipment.reduce((s, e) => s + e.count, 0);
      const nl = log.nodes.find(r => r.id === node.id);
      const isSel = selNode === node.id;
      const primaryCat = getPrimaryCategory(node);

      let nodeMgrs = "";
      try { nodeMgrs = toMgrs([node.lng, node.lat], 5); } catch { /* */ }

      if (markersRef.current[node.id]) {
        markersRef.current[node.id].setLngLat([node.lng, node.lat]);
        const el = markersRef.current[node.id].getElement();
        updateMarkerElement(el, node, cnt, nl, isSel, primaryCat, nodeMgrs);
      } else {
        const el = document.createElement("div");
        updateMarkerElement(el, node, cnt, nl, isSel, primaryCat, nodeMgrs);

        const marker = new mapboxgl.Marker({ element: el, draggable: !drawMode && !addLocationMode })
          .setLngLat([node.lng, node.lat])
          .addTo(map);

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          onNodeDrag(node.id, lngLat.lng, lngLat.lat);
        });

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!drawMode && !addLocationMode) onNodeClick(node.id);
        });

        // Touch support for iPad
        el.addEventListener("touchend", (e) => {
          e.stopPropagation();
          if (!drawMode && !addLocationMode) onNodeClick(node.id);
        });

        markersRef.current[node.id] = marker;
      }

      const marker = markersRef.current[node.id];
      if (marker.isDraggable() !== (!drawMode && !addLocationMode)) {
        marker.setDraggable(!drawMode && !addLocationMode);
      }
    });
  }, [nodes, selNode, log, drawMode, addLocationMode, onNodeClick, onNodeDrag, eqDb]);

  // Shape layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    addShapeLayers(map, nodes);
  }, [nodes]);

  // Route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const addRouteLine = () => {
      if (map.getLayer("taclog-route-line")) map.removeLayer("taclog-route-line");
      if (map.getLayer("taclog-route-line-dash")) map.removeLayer("taclog-route-line-dash");
      if (map.getSource("taclog-route")) map.removeSource("taclog-route");
      if (!routeLine) return;
      const [lng1, lat1, lng2, lat2] = routeLine;
      map.addSource("taclog-route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[lng1, lat1], [lng2, lat2]] } },
      });
      map.addLayer({ id: "taclog-route-line", type: "line", source: "taclog-route", paint: { "line-color": "#b45309", "line-width": 3, "line-opacity": 0.8 } });
      map.addLayer({ id: "taclog-route-line-dash", type: "line", source: "taclog-route", paint: { "line-color": "#d97706", "line-width": 1.5, "line-dasharray": [4, 4], "line-opacity": 0.9 } });
    };
    if (map.isStyleLoaded()) addRouteLine();
    else map.once("style.load", addRouteLine);
  }, [routeLine]);

  // Drawing overlay
  useEffect(() => {
    const canvas = canvasOverlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    if (strokePoints.length > 1) {
      ctx.strokeStyle = "rgba(45,74,34,0.5)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(strokePoints[0].x, strokePoints[0].y);
      strokePoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }
  }, [strokePoints]);

  // Helper: get x,y from mouse or touch event
  const getXY = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const rect = canvasOverlayRef.current?.getBoundingClientRect();
    if (!rect) return null;
    if ("touches" in e) {
      const t = e.touches[0] || (e as React.TouchEvent).changedTouches[0];
      if (!t) return null;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const onOverlayDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawMode) return;
    const pt = getXY(e);
    if (!pt) return;
    setDrawing(true);
    setStrokePoints([pt]);
  };
  const onOverlayMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || !drawMode) return;
    const pt = getXY(e);
    if (pt) setStrokePoints(prev => [...prev, pt]);
  };
  const onOverlayUp = () => {
    if (!drawing || !drawMode) return;
    setDrawing(false);
    const map = mapRef.current;
    if (!map || strokePoints.length < 8) { setStrokePoints([]); return; }
    const b = pixelBounds(strokePoints);
    if (b.w < 15 && b.h < 15) { setStrokePoints([]); return; }
    const first = strokePoints[0], last = strokePoints[strokePoints.length - 1];
    const pDist = Math.sqrt((first.x - last.x) ** 2 + (first.y - last.y) ** 2);
    if (pDist >= Math.max(b.w, b.h) * 0.4) { setStrokePoints([]); return; }
    const sw = map.unproject([b.minX, b.maxY]);
    const ne = map.unproject([b.maxX, b.minY]);
    const centerPx = map.unproject([b.cx, b.cy]);
    const aspect = Math.min(b.w, b.h) / Math.max(b.w, b.h);
    const shapeType: "circle" | "rect" = aspect > 0.7 ? "circle" : "rect";
    const radiusKm = haversineKm({ lng: sw.lng, lat: sw.lat }, { lng: ne.lng, lat: ne.lat }) / 2;
    onAddNode(centerPx.lng, centerPx.lat, shapeType, {
      center: [centerPx.lng, centerPx.lat], radiusKm,
      bounds: [[sw.lng, sw.lat], [ne.lng, ne.lat]], type: shapeType,
    });
    setStrokePoints([]);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {drawMode && (
        <canvas
          ref={canvasOverlayRef}
          className="absolute inset-0 w-full h-full z-10"
          style={{ cursor: "crosshair", pointerEvents: "auto", touchAction: "none" }}
          onMouseDown={onOverlayDown}
          onMouseMove={onOverlayMove}
          onMouseUp={onOverlayUp}
          onTouchStart={onOverlayDown}
          onTouchMove={onOverlayMove}
          onTouchEnd={onOverlayUp}
        />
      )}

      {/* Style switcher */}
      <div className="absolute top-2.5 right-14 z-20 flex bg-card/90 rounded overflow-hidden panel-shadow">
        {STYLES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => switchStyle(i)}
            className="px-2.5 py-1 text-[10px] border-0 cursor-pointer transition-colors duration-200"
            style={{
              background: styleIdx === i ? "hsl(var(--primary))" : "transparent",
              color: styleIdx === i ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
              fontWeight: styleIdx === i ? 500 : 400,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Status bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground panel-shadow">
        <div className="flex items-center gap-4">
          {drawMode ? (
            <span className="text-tac-info font-medium">Draw a circle or rectangle to create a location</span>
          ) : addLocationMode ? (
            <span className="text-tac-info font-medium">Click on the map to place a new location</span>
          ) : routeMode ? (
            <span style={{ color: 'hsl(var(--tac-amber))', fontWeight: 500 }}>
              {routeStart ? "Click destination location" : "Click start location for route analysis"}
            </span>
          ) : (
            <>
              {mgrsCoord && (
                <span>
                  <span className="text-muted-foreground">MGRS </span>
                  <span className="text-primary font-medium">{mgrsCoord}</span>
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span><span className="text-foreground font-medium">{totalLocations}</span> locations</span>
          <span><span className="text-foreground font-medium">{totalVehicles}</span> vehicles</span>
          <span><span className="text-foreground font-medium">{hours}h</span> mission</span>
          <span><span className="text-tac-amber font-medium">{totalFuel.toLocaleString()}</span> gal total</span>
        </div>
      </div>
    </div>
  );
}

function updateMarkerElement(
  el: HTMLElement,
  node: MapNode,
  cnt: number,
  nl: { fuel: number } | undefined,
  isSel: boolean,
  primaryCat: string,
  nodeMgrs: string,
) {
  el.innerHTML = "";
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;position:relative;";

  const PRIMARY = "#2d4a22";
  const DIM = "#8a8070";

  // Badge
  if (cnt > 0) {
    const badge = document.createElement("div");
    badge.style.cssText = `position:absolute;top:-6px;right:-6px; background:${PRIMARY};color:white; font-size:9px;font-weight:500;font-family:'DM Mono',monospace; width:18px;height:18px;display:flex;align-items:center;justify-content:center; border-radius:50%;z-index:2;border:2px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.2);`;
    badge.textContent = String(cnt);
    el.appendChild(badge);
  }

  // Main marker circle — larger touch target for iPad (44px min recommended)
  const dot = document.createElement("div");
  const iconSvg = CAT_ICONS[primaryCat] || DEFAULT_ICON;
  dot.style.cssText = `width:44px;height:44px;border-radius:50%; background:${isSel ? 'hsl(40,22%,95%)' : 'hsl(40,20%,92%)'}; border:${isSel ? `3px solid ${PRIMARY}` : `2px solid ${DIM}`}; display:flex;align-items:center;justify-content:center; box-shadow:${isSel ? `0 0 0 4px rgba(45,74,34,0.2), 0 2px 8px rgba(0,0,0,0.15)` : '0 2px 6px rgba(0,0,0,0.12)'}; transition:all 0.2s ease; color:${cnt > 0 ? PRIMARY : DIM};`;
  dot.innerHTML = cnt > 0 ? iconSvg : `<div style="width:6px;height:6px;border-radius:50%;background:${DIM}"></div>`;
  el.appendChild(dot);

  // Label
  const label = document.createElement("div");
  label.style.cssText = `margin-top:3px;font-size:10px;font-weight:500;font-family:'DM Mono',monospace; color:${isSel ? PRIMARY : 'hsl(40,8%,30%)'}; text-shadow:0 1px 3px rgba(255,255,255,0.9); white-space:nowrap;letter-spacing:0.3px;`;
  label.textContent = node.name;
  el.appendChild(label);

  // Fuel label
  if (nl && nl.fuel > 0) {
    const fuelLabel = document.createElement("div");
    fuelLabel.style.cssText = `font-size:8px;font-family:'DM Mono',monospace;color:${DIM};`;
    fuelLabel.textContent = `${nl.fuel.toLocaleString()}g`;
    el.appendChild(fuelLabel);
  }

  // Tooltip on hover
  const tooltip = document.createElement("div");
  tooltip.style.cssText = `position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%); background:hsl(90,10%,14%);color:white;padding:6px 10px;border-radius:6px; font-size:9px;font-family:'DM Mono',monospace;white-space:nowrap; opacity:0;pointer-events:none;transition:opacity 0.15s ease; box-shadow:0 4px 12px rgba(0,0,0,0.25);z-index:10;line-height:1.5;`;
  tooltip.innerHTML = `<div style="font-weight:500;font-size:10px;margin-bottom:2px">${node.name}</div> <div>${cnt} vehicle${cnt !== 1 ? 's' : ''} · ${nl?.fuel ? nl.fuel.toLocaleString() + 'g fuel' : 'No fuel req'}</div> ${nodeMgrs ? `<div style="color:rgba(255,255,255,0.6)">MGRS ${nodeMgrs}</div>` : ''}`;
  const arrow = document.createElement("div");
  arrow.style.cssText = `position:absolute;bottom:-4px;left:50%; width:8px;height:8px;background:hsl(90,10%,14%); transform:translateX(-50%) rotate(45deg);`;
  tooltip.appendChild(arrow);
  el.appendChild(tooltip);

  el.addEventListener("mouseenter", () => { tooltip.style.opacity = "1"; });
  el.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
}

function pixelBounds(pts: { x: number; y: number }[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(p => {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  });
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

function addShapeLayers(map: mapboxgl.Map, nodes: MapNode[]) {
  const style = map.getStyle();
  if (style?.layers) {
    style.layers.forEach(l => {
      if (l.id.startsWith("taclog-shape-")) map.removeLayer(l.id);
    });
  }
  if (style?.sources) {
    Object.keys(style.sources).forEach(s => {
      if (s.startsWith("taclog-shape-")) map.removeSource(s);
    });
  }

  nodes.forEach(node => {
    if (!node.shapeData?.bounds) return;
    const srcId = `taclog-shape-${node.id}`;
    const layerId = `taclog-shape-${node.id}`;
    const [[swLng, swLat], [neLng, neLat]] = node.shapeData.bounds;

    if (node.shape === "circle" && node.shapeData.center) {
      const [cLng, cLat] = node.shapeData.center;
      const rKm = node.shapeData.radiusKm || 1;
      const coords: [number, number][] = [];
      for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * 2 * Math.PI;
        const dLat = (rKm / 111.32) * Math.cos(angle);
        const dLng = (rKm / (111.32 * Math.cos(cLat * Math.PI / 180))) * Math.sin(angle);
        coords.push([cLng + dLng, cLat + dLat]);
      }
      map.addSource(srcId, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } } });
    } else {
      map.addSource(srcId, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[swLng, swLat], [neLng, swLat], [neLng, neLat], [swLng, neLat], [swLng, swLat]]] } },
      });
    }
    map.addLayer({ id: layerId, type: "fill", source: srcId, paint: { "fill-color": "#2d4a22", "fill-opacity": 0.08 } });
    map.addLayer({ id: layerId + "-outline", type: "line", source: srcId, paint: { "line-color": "#2d4a22", "line-width": 2, "line-dasharray": [4, 2], "line-opacity": 0.4 } });
  });
}

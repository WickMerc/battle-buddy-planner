import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { forward as toMgrs } from "mgrs";
import {
  gid, haversineMi, haversineKm,
  type MapNode, type LogisticsResult,
} from "@/lib/taclog-data";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

const STYLES = [
  { id: "mapbox://styles/mapbox/outdoors-v12", label: "Terrain" },
  { id: "mapbox://styles/mapbox/satellite-streets-v12", label: "Satellite" },
  { id: "mapbox://styles/mapbox/dark-v11", label: "Dark" },
];

interface MapboxMapProps {
  nodes: MapNode[];
  selNode: string | null;
  log: LogisticsResult;
  drawMode: boolean;
  onNodeClick: (id: string) => void;
  onNodeDrag: (id: string, lng: number, lat: number) => void;
  onAddNode: (lng: number, lat: number, shape: "point" | "circle" | "rect", shapeData?: MapNode["shapeData"]) => void;
  onDeselectNode: () => void;
  addLocationMode: boolean;
}

export default function MapboxMap({
  nodes, selNode, log, drawMode, onNodeClick, onNodeDrag, onAddNode, onDeselectNode, addLocationMode,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const [mgrsCoord, setMgrsCoord] = useState<string>("");
  const [styleIdx, setStyleIdx] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [strokePoints, setStrokePoints] = useState<{ x: number; y: number }[]>([]);
  const canvasOverlayRef = useRef<HTMLCanvasElement>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLES[0].id,
      center: [-79.0, 35.14],
      zoom: 10,
      pitchWithRotate: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ unit: "imperial" }), "bottom-left");

    map.on("load", () => {
      // Add terrain
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
        const mgrs = toMgrs([e.lngLat.lng, e.lngLat.lat], 5);
        setMgrsCoord(mgrs);
      } catch {
        setMgrsCoord("");
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle map click for adding locations
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

  // Update cursor based on mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvasContainer();
    if (addLocationMode) {
      canvas.style.cursor = "crosshair";
    } else if (drawMode) {
      canvas.style.cursor = "crosshair";
    } else {
      canvas.style.cursor = "";
    }
  }, [addLocationMode, drawMode]);

  // Style switching
  const switchStyle = useCallback((idx: number) => {
    const map = mapRef.current;
    if (!map) return;
    setStyleIdx(idx);
    map.setStyle(STYLES[idx].id);
    map.once("style.load", () => {
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
      }
      // Re-add shape layers
      addShapeLayers(map, nodes);
    });
  }, [nodes]);

  // Sync markers with nodes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(nodes.map(n => n.id));
    // Remove stale markers
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

      if (markersRef.current[node.id]) {
        // Update position and element
        markersRef.current[node.id].setLngLat([node.lng, node.lat]);
        const el = markersRef.current[node.id].getElement();
        updateMarkerElement(el, node, cnt, nl, isSel);
      } else {
        // Create new marker
        const el = document.createElement("div");
        updateMarkerElement(el, node, cnt, nl, isSel);

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

        markersRef.current[node.id] = marker;
      }

      // Update draggable state
      const marker = markersRef.current[node.id];
      if (marker.isDraggable() !== (!drawMode && !addLocationMode)) {
        marker.setDraggable(!drawMode && !addLocationMode);
      }
    });
  }, [nodes, selNode, log, drawMode, addLocationMode, onNodeClick, onNodeDrag]);

  // Add shape layers for circle/rect nodes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    addShapeLayers(map, nodes);
  }, [nodes]);

  // Drawing overlay for shape creation
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
      ctx.strokeStyle = "rgba(48, 96, 160, 0.6)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(strokePoints[0].x, strokePoints[0].y);
      strokePoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }
  }, [strokePoints]);

  const onOverlayDown = (e: React.MouseEvent) => {
    if (!drawMode) return;
    const rect = canvasOverlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrawing(true);
    setStrokePoints([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
  };

  const onOverlayMove = (e: React.MouseEvent) => {
    if (!drawing || !drawMode) return;
    const rect = canvasOverlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    setStrokePoints(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top }]);
  };

  const onOverlayUp = () => {
    if (!drawing || !drawMode) return;
    setDrawing(false);

    const map = mapRef.current;
    if (!map || strokePoints.length < 8) {
      setStrokePoints([]);
      return;
    }

    // Classify shape from pixel points
    const b = pixelBounds(strokePoints);
    if (b.w < 15 && b.h < 15) { setStrokePoints([]); return; }

    const first = strokePoints[0], last = strokePoints[strokePoints.length - 1];
    const pDist = Math.sqrt((first.x - last.x) ** 2 + (first.y - last.y) ** 2);
    const closed = pDist < Math.max(b.w, b.h) * 0.4;
    if (!closed) { setStrokePoints([]); return; }

    // Convert pixel corners to geographic coords
    const sw = map.unproject([b.minX, b.maxY]); // bottom-left pixel = sw
    const ne = map.unproject([b.maxX, b.minY]); // top-right pixel = ne
    const centerPx = map.unproject([b.cx, b.cy]);

    const aspect = Math.min(b.w, b.h) / Math.max(b.w, b.h);
    const shapeType: "circle" | "rect" = aspect > 0.7 ? "circle" : "rect";

    const radiusKm = haversineKm(
      { lng: sw.lng, lat: sw.lat },
      { lng: ne.lng, lat: ne.lat }
    ) / 2;

    const shapeData: MapNode["shapeData"] = {
      center: [centerPx.lng, centerPx.lat],
      radiusKm,
      bounds: [[sw.lng, sw.lat], [ne.lng, ne.lat]],
      type: shapeType,
    };

    onAddNode(centerPx.lng, centerPx.lat, shapeType, shapeData);
    setStrokePoints([]);
  };

  // Distance lines between selected node and others
  const selNodeData = nodes.find(n => n.id === selNode);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Drawing overlay */}
      {drawMode && (
        <canvas
          ref={canvasOverlayRef}
          className="absolute inset-0 w-full h-full z-10"
          style={{ cursor: "crosshair", pointerEvents: drawMode ? "auto" : "none" }}
          onMouseDown={onOverlayDown}
          onMouseMove={onOverlayMove}
          onMouseUp={onOverlayUp}
        />
      )}

      {/* Style switcher */}
      <div className="absolute top-2.5 right-14 z-20 flex bg-card/90 border border-border rounded overflow-hidden shadow-sm">
        {STYLES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => switchStyle(i)}
            className="px-2.5 py-1 text-[10px] font-mono border-0 cursor-pointer transition-colors"
            style={{
              background: styleIdx === i ? "hsl(var(--primary))" : "transparent",
              color: styleIdx === i ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
              fontWeight: styleIdx === i ? 600 : 400,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Distance info overlay */}
      {selNodeData && nodes.filter(n => n.id !== selNode).map(n => {
        const mi = haversineMi(selNodeData, n).toFixed(1);
        const km = haversineKm(selNodeData, n).toFixed(1);
        const map = mapRef.current;
        if (!map) return null;
        const midLng = (selNodeData.lng + n.lng) / 2;
        const midLat = (selNodeData.lat + n.lat) / 2;
        const px = map.project([midLng, midLat]);
        return (
          <div
            key={`dist-${n.id}`}
            className="absolute z-10 bg-card/95 border border-border rounded px-2 py-0.5 text-[9px] font-mono font-semibold text-secondary-foreground pointer-events-none shadow-sm"
            style={{ left: px.x - 30, top: px.y - 10 }}
          >
            {mi}mi / {km}km
          </div>
        );
      })}

      {/* Status bar */}
      <div className="absolute bottom-2 left-24 z-20 bg-card/90 border border-border rounded px-2.5 py-1 text-[10px] text-muted-foreground font-mono">
        {drawMode ? (
          <span className="text-tac-info font-semibold">Draw a circle or rectangle to create a location</span>
        ) : addLocationMode ? (
          <span className="text-tac-info font-semibold">Click on the map to place a new location</span>
        ) : (
          <span>
            Click location to edit · Drag to reposition
            {mgrsCoord && <span className="ml-2 text-primary font-semibold">MGRS: {mgrsCoord}</span>}
          </span>
        )}
      </div>
    </div>
  );
}

function updateMarkerElement(
  el: HTMLElement,
  node: MapNode,
  cnt: number,
  nl: { fuel: number } | undefined,
  isSel: boolean
) {
  el.innerHTML = "";
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;";

  // Badge
  if (cnt > 0) {
    const badge = document.createElement("div");
    badge.style.cssText = `
      position:absolute;top:-8px;right:-8px;
      background:hsl(152,55%,30%);color:white;
      font-size:9px;font-weight:700;font-family:monospace;
      width:16px;height:14px;display:flex;align-items:center;justify-content:center;
      border-radius:3px;z-index:2;
    `;
    badge.textContent = String(cnt);
    el.appendChild(badge);
  }

  // Dot
  const dot = document.createElement("div");
  dot.style.cssText = `
    width:32px;height:32px;border-radius:50%;
    background:hsl(36,25%,94%);
    border:${isSel ? "3px solid hsl(152,55%,30%)" : "2px solid hsl(36,8%,52%)"};
    display:flex;align-items:center;justify-content:center;
    box-shadow:${isSel ? "0 0 0 4px hsla(152,55%,30%,0.2)" : "0 1px 4px rgba(0,0,0,0.15)"};
    transition:all 0.15s;
  `;
  const inner = document.createElement("div");
  inner.style.cssText = `
    width:6px;height:6px;border-radius:50%;
    background:${cnt > 0 ? "hsl(152,55%,30%)" : "hsl(36,8%,52%)"};
  `;
  dot.appendChild(inner);
  el.appendChild(dot);

  // Label
  const label = document.createElement("div");
  label.style.cssText = `
    margin-top:4px;font-size:10px;font-weight:700;font-family:monospace;
    color:${isSel ? "hsl(152,55%,30%)" : "hsl(36,8%,35%)"};
    text-shadow:0 1px 2px rgba(255,255,255,0.8);
    white-space:nowrap;
  `;
  label.textContent = node.name;
  el.appendChild(label);

  // Fuel label
  if (nl && nl.fuel > 0) {
    const fuelLabel = document.createElement("div");
    fuelLabel.style.cssText = "font-size:8px;font-family:monospace;color:hsl(36,8%,52%);";
    fuelLabel.textContent = `${nl.fuel.toLocaleString()}g`;
    el.appendChild(fuelLabel);
  }
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
  // Remove old shape layers/sources
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
      // Approximate circle as polygon
      const [cLng, cLat] = node.shapeData.center;
      const rKm = node.shapeData.radiusKm || 1;
      const coords: [number, number][] = [];
      for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * 2 * Math.PI;
        const dLat = (rKm / 111.32) * Math.cos(angle);
        const dLng = (rKm / (111.32 * Math.cos(cLat * Math.PI / 180))) * Math.sin(angle);
        coords.push([cLng + dLng, cLat + dLat]);
      }
      map.addSource(srcId, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } },
      });
    } else {
      // Rectangle
      map.addSource(srcId, {
        type: "geojson",
        data: {
          type: "Feature", properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [[[swLng, swLat], [neLng, swLat], [neLng, neLat], [swLng, neLat], [swLng, swLat]]],
          },
        },
      });
    }

    map.addLayer({
      id: layerId,
      type: "fill",
      source: srcId,
      paint: { "fill-color": "hsl(215, 50%, 40%)", "fill-opacity": 0.1 },
    });
    map.addLayer({
      id: layerId + "-outline",
      type: "line",
      source: srcId,
      paint: { "line-color": "hsl(215, 50%, 40%)", "line-width": 2, "line-dasharray": [4, 2] },
    });
  });
}

import { useEffect, useMemo, useRef, useState } from "react";

const TILE = 256;
const MIN_ZOOM = 4;
const MAX_ZOOM = 16;

export function parseGeocode(value) {
  if (!value) return null;
  const match = String(value).match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function mapsHref(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function formatCoord(value) {
  return Number(value).toFixed(6);
}

function project(lat, lng, zoom) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  return { x, y };
}

function unproject(x, y, zoom) {
  const n = 2 ** zoom;
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return { lat: (latRad * 180) / Math.PI, lng };
}

function fitView(points, width, height) {
  if (!points.length || width < 40) return { center: { lat: 22.5, lng: 82.5 }, zoom: 5 };
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }
  const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
  if (minLat === maxLat && minLng === maxLng) return { center, zoom: 12 };
  for (let zoom = 15; zoom >= MIN_ZOOM; zoom -= 1) {
    const nw = project(maxLat, minLng, zoom);
    const se = project(minLat, maxLng, zoom);
    const w = Math.abs(se.x - nw.x) * TILE;
    const h = Math.abs(se.y - nw.y) * TILE;
    if (w <= width - 72 && h <= height - 72) return { center, zoom };
  }
  return { center, zoom: MIN_ZOOM };
}

function samePoint(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 0.00002 && Math.abs(a.lng - b.lng) < 0.00002;
}

export default function TollMap({ points, picked, onPick }) {
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 420 });
  const [view, setView] = useState(() => fitView(points, 800, 420));
  const pointsKey = points.map((point) => point.key).join("|");

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    setView(fitView(points, el?.clientWidth || size.width, el?.clientHeight || size.height));
  }, [pointsKey]);

  useEffect(() => {
    if (!picked) return;
    setView((current) => ({
      center: { lat: picked.lat, lng: picked.lng },
      zoom: Math.max(current.zoom, 12),
    }));
  }, [picked?.lat, picked?.lng]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -1 : 1;
      setView((current) => ({
        ...current,
        zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom + delta)),
      }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const scene = useMemo(() => {
    const center = project(view.center.lat, view.center.lng, view.zoom);
    const originX = center.x * TILE - size.width / 2;
    const originY = center.y * TILE - size.height / 2;
    const scale = 2 ** view.zoom;
    const x0 = Math.floor(originX / TILE);
    const y0 = Math.floor(originY / TILE);
    const x1 = Math.floor((originX + size.width) / TILE);
    const y1 = Math.floor((originY + size.height) / TILE);
    const tiles = [];
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        if (y < 0 || y >= scale) continue;
        const wrapped = ((x % scale) + scale) % scale;
        tiles.push({
          key: `${view.zoom}/${x}/${y}`,
          url: `https://tile.openstreetmap.org/${view.zoom}/${wrapped}/${y}.png`,
          left: x * TILE - originX,
          top: y * TILE - originY,
        });
      }
    }
    const markers = points.map((point) => {
      const projected = project(point.lat, point.lng, view.zoom);
      return {
        ...point,
        left: projected.x * TILE - originX,
        top: projected.y * TILE - originY,
        active: samePoint(point, picked),
      };
    });
    let pickedMarker = null;
    if (picked && !markers.some((marker) => marker.active)) {
      const projected = project(picked.lat, picked.lng, view.zoom);
      pickedMarker = {
        left: projected.x * TILE - originX,
        top: projected.y * TILE - originY,
      };
    }
    return { tiles, markers, pickedMarker, originX, originY };
  }, [view, size, points, picked]);

  function zoomBy(delta) {
    setView((current) => ({
      ...current,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom + delta)),
    }));
  }

  function onPointerDown(event) {
    if (event.target.closest("button, a")) return;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      moved: false,
      center: view.center,
      zoom: view.zoom,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    const start = project(drag.center.lat, drag.center.lng, drag.zoom);
    const next = unproject(start.x - dx / TILE, start.y - dy / TILE, drag.zoom);
    setView((current) => ({ ...current, center: next }));
  }

  function onPointerUp(event) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (drag.moved || event.target.closest("button, a")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const worldX = (scene.originX + (event.clientX - rect.left)) / TILE;
    const worldY = (scene.originY + (event.clientY - rect.top)) / TILE;
    const geo = unproject(worldX, worldY, view.zoom);
    onPick?.({
      lat: geo.lat,
      lng: geo.lng,
      label: "Picked on map",
    });
  }

  return (
    <div className="ft-map-layout">
      <div className="ft-map-stage">
        <div
          ref={rootRef}
          className="ft-map"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { dragRef.current = null; }}
        >
          {scene.tiles.map((tile) => (
            <img
              key={tile.key}
              className="ft-map-tile"
              src={tile.url}
              alt=""
              draggable={false}
              style={{ left: tile.left, top: tile.top }}
            />
          ))}
          {scene.markers.map((marker) => (
            <button
              key={marker.key}
              type="button"
              className={`ft-pin${marker.active ? " is-picked" : ""}`}
              style={{ left: marker.left, top: marker.top }}
              title={`${marker.name} (${formatCoord(marker.lat)}, ${formatCoord(marker.lng)})`}
              onClick={() => onPick?.(marker)}
            >
              <span>{marker.count}</span>
            </button>
          ))}
          {scene.pickedMarker ? (
            <span className="ft-pin is-picked is-free" style={{ left: scene.pickedMarker.left, top: scene.pickedMarker.top }} />
          ) : null}
          {!points.length ? (
            <p className="ft-map-empty">No toll coordinates in this filter. Click the map to pick a location.</p>
          ) : null}
          <div className="ft-map-zoom">
            <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1)}>+</button>
            <button type="button" aria-label="Zoom out" onClick={() => zoomBy(-1)}>−</button>
            <button type="button" aria-label="Fit toll plazas" onClick={() => setView(fitView(points, size.width, size.height))}>Fit</button>
          </div>
          <p className="ft-map-attr">© OpenStreetMap</p>
        </div>
        <div className="ft-picked">
          {picked ? (
            <>
              <strong>{picked.label || picked.name || "Location"}</strong>
              <span>{formatCoord(picked.lat)}, {formatCoord(picked.lng)}</span>
              <a href={mapsHref(picked.lat, picked.lng)} target="_blank" rel="noreferrer">
                Open in Google Maps
              </a>
            </>
          ) : (
            <span className="text-muted">Click a toll pin, a geocode link, or the map to pick coordinates.</span>
          )}
        </div>
      </div>
      <div className="ft-plaza-list">
        <p className="ft-plaza-title">Toll plazas</p>
        {points.map((point) => (
          <button
            key={point.key}
            type="button"
            className={`ft-plaza${samePoint(point, picked) ? " is-picked" : ""}`}
            onClick={() => onPick?.(point)}
          >
            <strong>{point.name}</strong>
            <span>{`${formatCoord(point.lat)}, ${formatCoord(point.lng)}`}</span>
            <em>{`${point.count} ${point.count === 1 ? "read" : "reads"} · ${point.vehicles.length} ${point.vehicles.length === 1 ? "vehicle" : "vehicles"}`}</em>
          </button>
        ))}
        {!points.length ? <p className="text-muted">No plazas match the current filters.</p> : null}
      </div>
    </div>
  );
}

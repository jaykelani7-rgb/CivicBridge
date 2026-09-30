"use client";

import { AdvancedMarker, APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { LocateFixed, Rotate3D, ScanLine } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HotspotViewModel } from "@/lib/api/types";
import { resolveThreeDState, THREE_D_ENTER_ZOOM, transitionMapTilt, ZOOM_DEBOUNCE_MS } from "./hotspot-map-camera";
import { StreetViewViewer, useStreetViewRequest } from "./hotspot-street-view";

type Props = { items: HotspotViewModel[]; selectedId: string | null; onSelect: (id: string) => void; apiKey: string; mapId: string; reducedMotion: boolean };

export function markerColor(score: number): string { return score >= 75 ? "#d1603d" : score >= 55 ? "#e6a157" : "#6b8e23"; }
export function markerRadius(requestCount: number): number { return Math.max(12, Math.min(36, 10 + Math.sqrt(Math.max(0, requestCount)) * 6)); }

export async function loadDeckMapModules() {
  const [{ GoogleMapsOverlay }, { GeoJsonLayer, ScatterplotLayer }] = await Promise.all([
    import("@deck.gl/google-maps"),
    import("@deck.gl/layers"),
  ]);
  return { GeoJsonLayer, GoogleMapsOverlay, ScatterplotLayer };
}

export function HotspotMap(props: Props) {
  const center = props.items[0]?.geography?.public_centroid;
  return <APIProvider apiKey={props.apiKey} libraries={["marker"]}><div className="relative h-[min(65vh,520px)] min-h-80 overflow-hidden rounded-2xl"><Map mapId={props.mapId} defaultCenter={center ? { lat: center.latitude, lng: center.longitude } : { lat: 5, lng: 20 }} defaultZoom={center ? 10 : 2} gestureHandling="cooperative" disableDefaultUI colorScheme="LIGHT" reuseMaps tiltInteractionEnabled={false} headingInteractionEnabled={false}><MapExperience {...props}/></Map></div></APIProvider>;
}

function MapExperience(props: Props) {
  const map = useMap();
  const [zoom, setZoom] = useState(0);
  const [threeD, setThreeD] = useState(false);
  const threeDRef = useRef(false);
  const cancelTiltRef = useRef<() => void>(() => undefined);
  const streetViewTriggerRef = useRef<HTMLButtonElement>(null);
  const selected = props.items.find((item) => item.id === props.selectedId && item.geography);
  const streetView = useStreetViewRequest(map, selected);

  useEffect(() => {
    if (!map) return;
    let timer = 0;
    const evaluateZoom = () => {
      const nextZoom = map.getZoom() ?? 0;
      setZoom(nextZoom);
      const nextThreeD = resolveThreeDState(threeDRef.current, nextZoom);
      if (nextThreeD !== threeDRef.current) {
        threeDRef.current = nextThreeD;
        setThreeD(nextThreeD);
        map.setOptions({ tiltInteractionEnabled: nextThreeD, headingInteractionEnabled: nextThreeD });
        cancelTiltRef.current();
        cancelTiltRef.current = transitionMapTilt(map, nextThreeD ? 45 : 0, props.reducedMotion);
      }
    };
    evaluateZoom();
    const listener = map.addListener("zoom_changed", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(evaluateZoom, ZOOM_DEBOUNCE_MS);
    });
    return () => { window.clearTimeout(timer); listener.remove(); cancelTiltRef.current(); };
  }, [map, props.reducedMotion]);

  const resetView = useCallback(() => {
    if (!map) return;
    threeDRef.current = false;
    setThreeD(false);
    map.setOptions({ tiltInteractionEnabled: false, headingInteractionEnabled: false });
    cancelTiltRef.current();
    cancelTiltRef.current = transitionMapTilt(map, 0, props.reducedMotion);
    map.setHeading(0);
    const points = props.items.filter((item) => item.geography);
    if (points.length) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach((item) => bounds.extend({ lat: item.geography!.public_centroid.latitude, lng: item.geography!.public_centroid.longitude }));
      map.fitBounds(bounds, props.reducedMotion ? 0 : 48);
    }
  }, [map, props.items, props.reducedMotion]);

  return <>
    <MapLayers items={props.items} onSelect={props.onSelect} reducedMotion={props.reducedMotion}/>
    <HotspotMarkers items={props.items} selectedId={props.selectedId} onSelect={props.onSelect}/>
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2">
      <span role="status" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#092634]/15 bg-white/95 px-3 text-sm font-semibold text-[#092634] shadow-lg backdrop-blur"><Rotate3D className="h-4 w-4"/>{threeD ? "3D view" : "Top-down view"}</span>
      <Button type="button" variant="outline" className="pointer-events-auto border-[#092634]/15 bg-white/95 text-[#092634]" onClick={resetView}><LocateFixed className="mr-2 h-4 w-4"/>Reset view</Button>
    </div>
    {selected && zoom >= THREE_D_ENTER_ZOOM ? <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-col items-start gap-2 sm:right-auto">
      <Button ref={streetViewTriggerRef} type="button" variant="accent" className="w-full shadow-xl sm:w-auto" aria-label={`Explore street level near ${selected.category} hotspot in ${selected.geography!.locality}`} disabled={streetView.checking} onClick={() => void streetView.requestStreetView()}><ScanLine className="mr-2 h-4 w-4"/>{streetView.checking ? "Checking coverage…" : "Explore street level"}</Button>
      {streetView.message && !streetView.viewer ? <p className="max-w-sm rounded-lg border border-[#092634]/15 bg-white/95 px-3 py-2 text-sm text-[#092634] shadow-lg">{streetView.message}</p> : null}
    </div> : null}
    <p className="sr-only" aria-live="polite" aria-atomic="true">{streetView.message}</p>
    {map && selected && streetView.viewer ? <StreetViewViewer map={map} selected={selected} triggerRef={streetViewTriggerRef} camera={streetView.viewer.camera} coverage={streetView.viewer.coverage} onClose={streetView.closeViewer}/> : null}
  </>;
}

const HotspotMarkers = memo(function HotspotMarkers({ items, selectedId, onSelect }: Pick<Props, "items" | "selectedId" | "onSelect">) {
  return <>{items.map((item) => item.geography ? <AdvancedMarker key={item.id} position={{ lat: item.geography.public_centroid.latitude, lng: item.geography.public_centroid.longitude }} onClick={() => onSelect(item.id)} title={`Select ${item.category} hotspot in ${item.geography!.locality}; Action Score ${item.actionScore.toFixed(1)}`}><span aria-hidden="true" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg" style={{ width: markerRadius(item.requestCount), height: markerRadius(item.requestCount), background: markerColor(item.actionScore), opacity: Math.max(.65, item.evidenceConfidence), outline: selectedId === item.id ? "3px solid #67d2bd" : "none", outlineOffset: 3 }}>{Math.round(item.actionScore)}</span></AdvancedMarker> : null)}</>;
});

const MapLayers = memo(function MapLayers({ items, onSelect, reducedMotion }: Omit<Props, "apiKey" | "mapId" | "selectedId">) {
  const map = useMap();
  const points = useMemo(() => items.filter((item) => item.geography).map((item) => ({ ...item, coordinates: [item.geography!.public_centroid.longitude, item.geography!.public_centroid.latitude] as [number, number] })), [items]);
  useEffect(() => { if (!map || !points.length) return; const bounds = new google.maps.LatLngBounds(); points.forEach((item) => bounds.extend({ lat: item.coordinates[1], lng: item.coordinates[0] })); map.fitBounds(bounds, reducedMotion ? 0 : 48); }, [map, points, reducedMotion]);
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    let overlay: { setMap: (map: google.maps.Map | null) => void; finalize: () => void } | undefined;
    const boundaries = items.filter((item) => item.geography?.boundary_geojson).map((item) => item.geography!.boundary_geojson!);
    void loadDeckMapModules().then(({ GeoJsonLayer, GoogleMapsOverlay, ScatterplotLayer }) => {
      if (cancelled) return;
      overlay = new GoogleMapsOverlay({ interleaved: true, layers: [new ScatterplotLayer({ id: "hotspot-density", data: points, getPosition: (item) => item.coordinates, getRadius: (item) => markerRadius(item.requestCount) * 25, getFillColor: (item) => hex(markerColor(item.actionScore), Math.round(item.evidenceConfidence * 150)), radiusMinPixels: 10, radiusMaxPixels: 42, pickable: true, onClick: ({ object }) => object && onSelect((object as HotspotViewModel).id), transitions: reducedMotion ? undefined : { getRadius: 250 } }), ...(boundaries.length ? [new GeoJsonLayer({ id: "administrative-boundaries", data: { type: "FeatureCollection", features: boundaries.map((geometry) => ({ type: "Feature", properties: {}, geometry })) }, stroked: true, filled: false, getLineColor: [103,210,189,180], lineWidthMinPixels: 1 })] : [])] });
      overlay.setMap(map);
    }).catch(() => { /* Accessible markers and the base map remain available. */ });
    return () => { cancelled = true; overlay?.setMap(null); overlay?.finalize(); };
  }, [map, items, points, onSelect, reducedMotion]);
  return null;
});

function hex(value: string, alpha: number): [number, number, number, number] { return [Number.parseInt(value.slice(1,3),16), Number.parseInt(value.slice(3,5),16), Number.parseInt(value.slice(5,7),16), alpha]; }

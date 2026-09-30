"use client";

import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { AdvancedMarker, APIProvider, Map, useAdvancedMarkerRef, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useMemo } from "react";
import type { PublicHotspot } from "@/lib/api/types";

type Props = { items: PublicHotspot[]; selectedId: string | null; onSelect: (id: string) => void; apiKey: string; mapId: string };
const colors: Record<PublicHotspot["priority_band"], string> = { high: "#d1603d", medium: "#3f51b5", emerging: "#6b8e23" };

export function PublicHotspotMap(props: Props) {
  const center = props.items[0]?.public_centroid;
  return <APIProvider apiKey={props.apiKey} libraries={["marker"]}><div className="h-[min(60vh,34rem)] min-h-80 overflow-hidden rounded-2xl border border-border"><Map mapId={props.mapId} defaultCenter={center ? { lat: center.latitude, lng: center.longitude } : { lat: 5, lng: 20 }} defaultZoom={center ? 9 : 2} gestureHandling="cooperative" disableDefaultUI={false} colorScheme="LIGHT" reuseMaps><PublicMapOverlay {...props}/><ClusteredPublicMarkers {...props}/></Map></div></APIProvider>;
}

export async function loadPublicDeckMapModules() {
  const [{ GoogleMapsOverlay }, { ScatterplotLayer }] = await Promise.all([
    import("@deck.gl/google-maps"),
    import("@deck.gl/layers"),
  ]);
  return { GoogleMapsOverlay, ScatterplotLayer };
}

function ClusteredPublicMarkers({ items, selectedId, onSelect }: Props) {
  const map = useMap();
  const clusterer = useMemo(() => map ? new MarkerClusterer({ map }) : null, [map]);
  useEffect(() => () => { clusterer?.clearMarkers(); }, [clusterer]);
  return <>{items.map((item) => <ClusteredPublicMarker key={item.id} item={item} selected={selectedId === item.id} onSelect={onSelect} clusterer={clusterer}/>)}</>;
}

function ClusteredPublicMarker({ item, selected, onSelect, clusterer }: { item: PublicHotspot; selected: boolean; onSelect: (id: string) => void; clusterer: MarkerClusterer | null }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  useEffect(() => { if (!marker || !clusterer) return; clusterer.addMarker(marker); return () => { clusterer.removeMarker(marker); }; }, [clusterer, marker]);
  return <AdvancedMarker ref={markerRef} position={{ lat: item.public_centroid.latitude, lng: item.public_centroid.longitude }} title={`Select ${item.public_title} in ${item.administrative_area.locality}; ${item.priority_band} priority`} onClick={() => onSelect(item.id)}><span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white text-xs font-black uppercase text-white shadow-lg" style={{ background: colors[item.priority_band], outline: selected ? "3px solid #111827" : "none", outlineOffset: 2 }}>{item.priority_band.charAt(0)}</span></AdvancedMarker>;
}

function PublicMapOverlay({ items, onSelect }: Props) {
  const map = useMap();
  const points = useMemo(() => items.map((item) => ({ ...item, coordinates: [item.public_centroid.longitude, item.public_centroid.latitude] as [number, number] })), [items]);
  useEffect(() => { if (!map || !points.length) return; const bounds = new google.maps.LatLngBounds(); points.forEach((item) => bounds.extend({ lat: item.coordinates[1], lng: item.coordinates[0] })); map.fitBounds(bounds, { top: 40, right: 40, bottom: window.innerWidth < 768 ? 112 : 40, left: 40 }); }, [map, points]);
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    let overlay: { setMap: (map: google.maps.Map | null) => void; finalize: () => void } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle = 0;
    const load = () => { void loadPublicDeckMapModules().then(({ GoogleMapsOverlay, ScatterplotLayer }) => {
      if (cancelled) return;
      overlay = new GoogleMapsOverlay({ interleaved: true, layers: [new ScatterplotLayer({ id: "public-hotspot-density", data: points, getPosition: (item) => item.coordinates, getRadius: (item) => 350 + Math.sqrt(item.request_count) * 120, getFillColor: (item) => rgba(colors[(item as PublicHotspot).priority_band], 80), radiusMinPixels: 12, radiusMaxPixels: 34, pickable: true, onClick: ({ object }) => object && onSelect((object as PublicHotspot).id) })] });
      overlay.setMap(map);
    }).catch(() => { /* Base map and privacy-safe markers remain available. */ }); };
    if ("requestIdleCallback" in window) idle = window.requestIdleCallback(load, { timeout: 1200 });
    else timer = globalThis.setTimeout(load, 250);
    return () => { cancelled = true; if (idle) window.cancelIdleCallback(idle); if (timer) globalThis.clearTimeout(timer); overlay?.setMap(null); overlay?.finalize(); };
  }, [map, onSelect, points]);
  return null;
}

function rgba(hex: string, alpha: number): [number, number, number, number] { return [Number.parseInt(hex.slice(1,3),16), Number.parseInt(hex.slice(3,5),16), Number.parseInt(hex.slice(5,7),16), alpha]; }

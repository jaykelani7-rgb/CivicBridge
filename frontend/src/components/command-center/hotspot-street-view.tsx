"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import type { HotspotViewModel } from "@/lib/api/types";

export type PublicCentroid = { lat: number; lng: number };
export type StreetViewCoverage = { available: true; position: PublicCentroid; pano?: string } | { available: false };
type StreetViewServiceLike = {
  getPanorama: (
    request: google.maps.StreetViewLocationRequest,
    callback: (data: google.maps.StreetViewPanoramaData | null, status: google.maps.StreetViewStatus) => void,
  ) => unknown;
};
type StreetViewPanoramaLike = { setVisible: (visible: boolean) => void };
type StreetViewLibraryLike = {
  StreetViewService: new () => StreetViewServiceLike;
  StreetViewPanorama: new (container: HTMLElement, options: google.maps.StreetViewPanoramaOptions) => StreetViewPanoramaLike;
};
type CoverageLoader = () => Promise<StreetViewLibraryLike>;

const coverageCache = new Map<string, Promise<StreetViewCoverage>>();
let streetViewLibraryPromise: Promise<StreetViewLibraryLike> | undefined;

export function streetViewCacheKey(position: PublicCentroid): string {
  return `${position.lat.toFixed(4)},${position.lng.toFixed(4)}`;
}

export function clearStreetViewCoverageCache(): void {
  coverageCache.clear();
  streetViewLibraryPromise = undefined;
}

export function loadStreetViewLibrary(): Promise<StreetViewLibraryLike> {
  streetViewLibraryPromise ??= google.maps.importLibrary("streetView") as unknown as Promise<StreetViewLibraryLike>;
  return streetViewLibraryPromise;
}

function panoramaAtRadius(
  service: StreetViewServiceLike,
  position: PublicCentroid,
  radius: number,
  timeoutMs: number,
): Promise<StreetViewCoverage> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: StreetViewCoverage) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = window.setTimeout(() => finish({ available: false }), timeoutMs);
    try {
      service.getPanorama(
        { location: position, radius, source: google.maps.StreetViewSource.OUTDOOR },
        (data, status) => {
          const latLng = data?.location?.latLng;
          if (status === google.maps.StreetViewStatus.OK && latLng) {
            finish({ available: true, position: latLng.toJSON(), pano: data.location?.pano ?? undefined });
          } else {
            finish({ available: false });
          }
        },
      );
    } catch {
      finish({ available: false });
    }
  });
}

export function lookupStreetViewCoverage(
  position: PublicCentroid,
  loader: CoverageLoader = loadStreetViewLibrary,
  timeoutMs = 4500,
): Promise<StreetViewCoverage> {
  const key = streetViewCacheKey(position);
  const cached = coverageCache.get(key);
  if (cached) return cached;
  const lookup = loader().then(async ({ StreetViewService }) => {
    const service = new StreetViewService();
    const nearby = await panoramaAtRadius(service, position, 50, timeoutMs);
    return nearby.available ? nearby : panoramaAtRadius(service, position, 150, timeoutMs);
  }).catch((): StreetViewCoverage => ({ available: false }));
  coverageCache.set(key, lookup);
  return lookup;
}

type CameraSnapshot = { center: PublicCentroid; zoom: number; tilt: number; heading: number };

type StreetViewExperienceProps = {
  map: google.maps.Map;
  selected: HotspotViewModel;
  triggerRef: RefObject<HTMLButtonElement | null>;
  camera: CameraSnapshot;
  onClose: () => void;
  coverage: Extract<StreetViewCoverage, { available: true }>;
  libraryLoader?: CoverageLoader;
};

export function StreetViewViewer({ map, selected, triggerRef, camera, onClose, coverage, libraryLoader = loadStreetViewLibrary }: StreetViewExperienceProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const panoramaHostRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<StreetViewPanoramaLike | null>(null);
  const close = useCallback(() => {
    onClose();
    if (window.history.state?.civicbridgeStreetView) window.history.back();
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = "hidden";
    window.history.pushState({ ...window.history.state, civicbridgeStreetView: true }, "");
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const handlePopState = () => onClose();
    window.addEventListener("keydown", handleKey);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("popstate", handlePopState);
      panoramaRef.current?.setVisible(false);
      if (panoramaRef.current) google.maps.event.clearInstanceListeners(panoramaRef.current);
      map.moveCamera(camera);
      triggerElement?.focus();
    };
  }, [camera, close, map, onClose, triggerRef]);

  useEffect(() => {
    let cancelled = false;
    void libraryLoader().then(({ StreetViewPanorama }) => {
      if (cancelled || !panoramaHostRef.current) return;
      panoramaRef.current = new StreetViewPanorama(panoramaHostRef.current, {
        position: coverage.position,
        pano: coverage.pano,
        pov: { heading: camera.heading, pitch: 0 },
        zoom: 1,
        addressControl: false,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
        visible: true,
      });
    }).catch(() => close());
    return () => { cancelled = true; };
  }, [camera.heading, close, coverage, libraryLoader]);

  const locality = selected.geography?.locality ?? selected.geographyId;
  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Street View for ${selected.category} hotspot in ${locality}`} tabIndex={-1} className="fixed inset-0 z-[80] flex min-h-0 flex-col bg-white pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-[#092634] md:absolute md:inset-y-0 md:left-auto md:right-0 md:w-1/2 md:rounded-r-2xl md:border-l md:border-[#092634]/15">
    <div className="flex min-h-16 items-center justify-between gap-3 border-b border-[#092634]/15 bg-[#F9F9F9] px-4 py-2">
      <div className="min-w-0"><p className="text-sm font-bold capitalize">{selected.category} · {locality}</p><p className="text-xs text-[#a9b8c2]">Street imagery near the administrative centroid</p></div>
      <Button type="button" size="icon" variant="outline" className="shrink-0 border-[#092634]/20 bg-white text-[#092634]" aria-label={`Close Street View for ${selected.category} hotspot in ${locality}`} onClick={close}><X className="h-5 w-5"/></Button>
    </div>
    <div ref={panoramaHostRef} data-testid="street-view-panorama" className="min-h-0 flex-1" aria-label={`Street-level imagery near ${locality}`}/>
  </div>;
}

export function useStreetViewRequest(map: google.maps.Map | null, selected: HotspotViewModel | undefined) {
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<{ selectedId: string; message: string } | null>(null);
  const [viewerState, setViewer] = useState<{ selectedId: string; coverage: Extract<StreetViewCoverage, { available: true }>; camera: CameraSnapshot } | null>(null);
  const requestStreetView = useCallback(async () => {
    if (!map || !selected?.geography || checking) return;
    setChecking(true);
    setFeedback({ selectedId: selected.id, message: "Checking Street View coverage near this hotspot." });
    const center = map.getCenter()?.toJSON() ?? { lat: selected.geography.public_centroid.latitude, lng: selected.geography.public_centroid.longitude };
    const camera = { center, zoom: map.getZoom() ?? 17, tilt: map.getTilt() ?? 0, heading: map.getHeading() ?? 0 };
    const publicCentroid = { lat: selected.geography.public_centroid.latitude, lng: selected.geography.public_centroid.longitude };
    const coverage = await lookupStreetViewCoverage(publicCentroid);
    setChecking(false);
    if (coverage.available) {
      setFeedback({ selectedId: selected.id, message: "Street View is ready." });
      setViewer({ selectedId: selected.id, coverage, camera });
    } else {
      setFeedback({ selectedId: selected.id, message: "Street View is not available near this hotspot." });
    }
  }, [checking, map, selected]);
  const closeViewer = useCallback(() => setViewer(null), []);
  const message = feedback && feedback.selectedId === selected?.id ? feedback.message : "";
  const viewer = viewerState && viewerState.selectedId === selected?.id ? viewerState : null;
  return { checking, message, viewer, requestStreetView, closeViewer };
}

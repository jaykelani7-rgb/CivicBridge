import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HotspotViewModel } from "@/lib/api/types";
import {
  clearStreetViewCoverageCache,
  lookupStreetViewCoverage,
  StreetViewViewer,
  streetViewCacheKey,
  useStreetViewRequest,
  type StreetViewCoverage,
} from "./hotspot-street-view";

const hotspot: HotspotViewModel = {
  id: "hotspot-public-1", countryCode: "IN", geographyId: "IN-MH-NM",
  category: "water", status: "active", requestCount: 6, uniqueRequestCount: 6,
  duplicateCount: 0, relatedCount: 5, affectedPopulation: 0, needScore: 55,
  actionScore: 57, evidenceConfidence: .9, calculatedAt: "2026-08-22T00:00:00Z",
  warnings: [],
  geography: {
    geography_id: "IN-MH-NM", country_code: "IN", admin1: "Maharashtra", admin2: "Navi Mumbai",
    locality: "Navi Mumbai", public_centroid: { latitude: 19.03, longitude: 73.02, precision: "administrative_area" },
    boundary_geojson: null, boundary_source: "administrative", boundary_version: "1",
    location_precision: "administrative_area", limitation: "Administrative centroid only",
  },
};

const clearInstanceListeners = vi.fn();

beforeEach(() => {
  clearStreetViewCoverageCache();
  clearInstanceListeners.mockClear();
  vi.stubGlobal("google", { maps: {
    StreetViewSource: { OUTDOOR: "OUTDOOR" },
    StreetViewStatus: { OK: "OK", ZERO_RESULTS: "ZERO_RESULTS" },
    event: { clearInstanceListeners },
    importLibrary: vi.fn(),
  } });
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  window.history.replaceState({}, "");
  vi.unstubAllGlobals();
});

function loaderWithResponses(responses: Array<"OK" | "ZERO_RESULTS" | "THROW">, radii: number[]) {
  class StreetViewService {
    getPanorama(request: google.maps.StreetViewLocationRequest, callback: (data: google.maps.StreetViewPanoramaData | null, status: google.maps.StreetViewStatus) => void) {
      radii.push(request.radius ?? 0);
      const response = responses.shift();
      if (response === "THROW") throw new Error("maps failure");
      if (response === "OK") callback({ location: { latLng: { toJSON: () => ({ lat: 19.031, lng: 73.021 }) } as google.maps.LatLng, pano: "public-pano" } } as google.maps.StreetViewPanoramaData, "OK" as google.maps.StreetViewStatus);
      else callback(null, "ZERO_RESULTS" as google.maps.StreetViewStatus);
    }
  }
  return vi.fn(async () => ({ StreetViewService, StreetViewPanorama: class { setVisible() {} } }));
}

describe("Street View coverage", () => {
  it("looks up imagery only after explicit user action", async () => {
    const radii: number[] = [];
    const loader = loaderWithResponses(["OK"], radii);
    (google.maps.importLibrary as ReturnType<typeof vi.fn>).mockImplementation(loader);
    render(<RequestHarness/>);
    expect(google.maps.importLibrary).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Explore" }));
    await screen.findByText("ready");
    expect(google.maps.importLibrary).toHaveBeenCalledOnce();
    expect(radii).toEqual([50]);
  });

  it("returns a successful nearby panorama from the public centroid", async () => {
    const radii: number[] = [];
    const result = await lookupStreetViewCoverage({ lat: 19.03, lng: 73.02 }, loaderWithResponses(["OK"], radii));
    expect(result).toEqual({ available: true, position: { lat: 19.031, lng: 73.021 }, pano: "public-pano" });
    expect(radii).toEqual([50]);
  });

  it("retries ZERO_RESULTS at 150 metres and shows the fallback", async () => {
    const radii: number[] = [];
    const result = await lookupStreetViewCoverage({ lat: 19.03, lng: 73.02 }, loaderWithResponses(["ZERO_RESULTS", "ZERO_RESULTS"], radii));
    expect(result).toEqual({ available: false });
    expect(radii).toEqual([50, 150]);
  });

  it("handles Maps API failures without throwing", async () => {
    const result = await lookupStreetViewCoverage({ lat: 19.03, lng: 73.02 }, loaderWithResponses(["THROW", "THROW"], []));
    expect(result).toEqual({ available: false });
  });

  it("caches rounded administrative centroids for the browser session", async () => {
    const radii: number[] = [];
    const loader = loaderWithResponses(["OK"], radii);
    expect(streetViewCacheKey({ lat: 19.03001, lng: 73.02001 })).toBe(streetViewCacheKey({ lat: 19.03002, lng: 73.02002 }));
    await lookupStreetViewCoverage({ lat: 19.03001, lng: 73.02001 }, loader);
    await lookupStreetViewCoverage({ lat: 19.03002, lng: 73.02002 }, loader);
    expect(loader).toHaveBeenCalledOnce();
  });
});

function RequestHarness() {
  const map = {
    getCenter: () => ({ toJSON: () => ({ lat: 19.03, lng: 73.02 }) }),
    getZoom: () => 17, getTilt: () => 45, getHeading: () => 10,
  } as unknown as google.maps.Map;
  const request = useStreetViewRequest(map, hotspot);
  return <><button onClick={() => void request.requestStreetView()}>Explore</button>{request.viewer ? <span>ready</span> : null}<span>{request.message}</span></>;
}

function ViewerHarness({ panorama, onClosed }: { panorama: { setVisible: (visible: boolean) => void; created?: () => void }; onClosed: () => void }) {
  const [open, setOpen] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const map = { moveCamera: vi.fn() } as unknown as google.maps.Map;
  const coverage: Extract<StreetViewCoverage, { available: true }> = { available: true, position: { lat: 19.031, lng: 73.021 }, pano: "public-pano" };
  class StreetViewPanorama { constructor() { panorama.created?.(); } setVisible(visible: boolean) { panorama.setVisible(visible); } }
  const loader = async () => ({ StreetViewService: class { getPanorama() {} }, StreetViewPanorama });
  return <><button ref={triggerRef}>Explore street level</button>{open ? <StreetViewViewer map={map} selected={hotspot} triggerRef={triggerRef} camera={{ center: { lat: 19.03, lng: 73.02 }, zoom: 17, tilt: 45, heading: 10 }} coverage={coverage} libraryLoader={loader} onClose={() => { setOpen(false); onClosed(); }}/> : null}</>;
}

describe("Street View viewer accessibility and mobile behavior", () => {
  it("uses a mobile full-screen dialog and creates the panorama", async () => {
    const panorama = { setVisible: vi.fn(), created: vi.fn() };
    render(<ViewerHarness panorama={panorama} onClosed={vi.fn()}/>);
    const dialog = screen.getByRole("dialog", { name: /water hotspot in Navi Mumbai/i });
    expect(dialog).toHaveClass("fixed", "inset-0");
    expect(screen.getByTestId("street-view-panorama")).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    await waitFor(() => expect(panorama.created).toHaveBeenCalledOnce());
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes with Escape, cleans up, and restores trigger focus", async () => {
    const panorama = { setVisible: vi.fn(), created: vi.fn() };
    const onClosed = vi.fn();
    render(<ViewerHarness panorama={panorama} onClosed={onClosed}/>);
    await waitFor(() => expect(panorama.created).toHaveBeenCalledOnce());
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onClosed).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Explore street level" })).toHaveFocus();
    expect(panorama.setVisible).toHaveBeenCalledWith(false);
    expect(clearInstanceListeners).toHaveBeenCalledOnce();
  });

  it("closes from the descriptive 44px close control", async () => {
    const onClosed = vi.fn();
    render(<ViewerHarness panorama={{ setVisible: vi.fn() }} onClosed={onClosed}/>);
    const close = screen.getByRole("button", { name: /Close Street View for water hotspot in Navi Mumbai/i });
    expect(close).toHaveClass("min-h-11", "min-w-11");
    fireEvent.click(close);
    await waitFor(() => expect(onClosed).toHaveBeenCalledOnce());
  });

  it("cleans panorama resources and body scroll on unmount", async () => {
    const panorama = { setVisible: vi.fn(), created: vi.fn() };
    const view = render(<ViewerHarness panorama={panorama} onClosed={vi.fn()}/>);
    await waitFor(() => expect(panorama.created).toHaveBeenCalledOnce());
    view.unmount();
    expect(document.body.style.overflow).toBe("");
    expect(panorama.setVisible).toHaveBeenCalledWith(false);
    expect(clearInstanceListeners).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from "vitest";
import { loadDeckMapModules, markerColor, markerRadius } from "./hotspot-map";
import { cameraTransitionDuration, resolveThreeDState, transitionMapTilt } from "./hotspot-map-camera";

describe("hotspot marker mappings", () => {
  it("maps action score to restrained priority colors", () => {
    expect(markerColor(80)).toBe("#d1603d");
    expect(markerColor(60)).toBe("#e6a157");
    expect(markerColor(40)).toBe("#6b8e23");
  });
  it("scales report volume within accessible bounds", () => {
    expect(markerRadius(0)).toBe(12);
    expect(markerRadius(1000)).toBe(36);
  });
  it("loads the optional deck.gl overlay modules on demand", async () => {
    const modules = await loadDeckMapModules();
    expect(modules.GoogleMapsOverlay).toBeTypeOf("function");
    expect(modules.ScatterplotLayer).toBeTypeOf("function");
    expect(modules.GeoJsonLayer).toBeTypeOf("function");
  });
});

describe("progressive 3D camera state", () => {
  it("enters 3D at the upper threshold", () => {
    expect(resolveThreeDState(false, 16.99)).toBe(false);
    expect(resolveThreeDState(false, 17)).toBe(true);
  });

  it("leaves 3D only below the lower threshold", () => {
    expect(resolveThreeDState(true, 16.5)).toBe(true);
    expect(resolveThreeDState(true, 16.49)).toBe(false);
  });

  it("does not oscillate between the separate thresholds", () => {
    const states = [17, 16.8, 16.6, 16.8, 16.5].reduce<boolean[]>((values, zoom) => {
      values.push(resolveThreeDState(values.at(-1) ?? false, zoom));
      return values;
    }, []);
    expect(states).toEqual([true, true, true, true, true]);
  });

  it("switches immediately for reduced motion and preserves heading", () => {
    const moveCamera = vi.fn();
    const map = { getTilt: () => 0, getHeading: () => 27, moveCamera } as unknown as google.maps.Map;
    expect(cameraTransitionDuration(true)).toBe(0);
    transitionMapTilt(map, 45, true);
    expect(moveCamera).toHaveBeenCalledOnce();
    expect(moveCamera).toHaveBeenCalledWith({ tilt: 45, heading: 27 });
  });
});

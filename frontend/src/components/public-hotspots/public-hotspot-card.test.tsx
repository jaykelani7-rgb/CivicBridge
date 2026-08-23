import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicLocaleProvider } from "@/components/providers/public-locale-provider";
import { PublicHotspotCard } from "./public-hotspot-card";
import type { PublicHotspot } from "@/lib/api/types";

const item: PublicHotspot = { id: "hotspot-secret-id", country_code: "IN", category: "drainage", public_title: "Recurring road flooding", public_summary: "Residents report repeated access disruption during rainfall.", administrative_area: { admin1: "Rajasthan", admin2: "Jaipur", locality: "Ward 42" }, public_centroid: { latitude: 26.91, longitude: 75.78, precision: "administrative_area" }, request_count: 5, priority_band: "high", public_status: "under_review", updated_at: "2026-08-22T12:00:00Z", project: null, synthetic: true };

describe("public hotspot card", () => {
  it("uses readable geography and creates a coordinate-free affected link", () => {
    render(<PublicLocaleProvider><PublicHotspotCard item={item}/></PublicLocaleProvider>);
    expect(screen.getByText("Ward 42, Jaipur, Rajasthan")).toBeInTheDocument();
    expect(screen.queryByText(/Need|Action Score|hotspot-secret-id/)).not.toBeInTheDocument();
    const href = screen.getByRole("link", { name: "I’m affected too" }).getAttribute("href") ?? "";
    expect(href).toContain("administrative_area=Ward+42%2C+Jaipur%2C+Rajasthan");
    expect(href).not.toMatch(/latitude|longitude|26\.91|75\.78/);
  });
});

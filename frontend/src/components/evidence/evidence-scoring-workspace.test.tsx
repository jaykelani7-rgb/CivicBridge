import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detailFixture, evidenceFixture, scoreFixture } from "@/test/evidence-fixtures";
import { EvidenceScoringWorkspace } from "./evidence-scoring-workspace";
import { HotspotDetailWorkspace } from "./hotspot-detail-workspace";
import { QuickScoreExplanation } from "./quick-score-explanation";

let params = new URLSearchParams("tab=overview");
const replace = vi.fn((value: string) => { params = new URLSearchParams(value.replace(/^\?/, "")); });
vi.mock("next/navigation", () => ({ useSearchParams: () => params, useRouter: () => ({ replace }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/lib/api/intelligence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/intelligence")>();
  return { ...actual, intelligenceApi: { ...actual.intelligenceApi, detail: vi.fn().mockResolvedValue(detailFixture), evidence: vi.fn().mockResolvedValue(evidenceFixture), score: vi.fn().mockResolvedValue(scoreFixture) } };
});
vi.mock("@/lib/api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth")>();
  return { ...actual, authApi: { ...actual.authApi, me: vi.fn().mockResolvedValue({ user: { uid: "staff", emailVerified: true, role: "analyst" } }) } };
});

function renderWithClient(node: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>);
}

beforeEach(() => { params = new URLSearchParams("tab=overview"); replace.mockClear(); HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); }; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("EvidenceScoringWorkspace", () => {
  it("renders the separate evidence route with demo warning and no private IDs or coordinates", async () => {
    renderWithClient(<EvidenceScoringWorkspace hotspotId="hotspot-1"/>);
    expect(await screen.findByRole("heading", { name: "Evidence & Scoring" })).toBeInTheDocument();
    expect(screen.getAllByText("Demonstration data — not official statistics").length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent("private-id-not-for-rendering");
    expect(document.body).not.toHaveTextContent("26.9");
  });

  it("keeps selected tabs in the URL and implements accessible tab state", async () => {
    renderWithClient(<EvidenceScoringWorkspace hotspotId="hotspot-1"/>);
    const scoreTab = await screen.findByRole("tab", { name: "Score Breakdown" });
    fireEvent.click(scoreTab);
    expect(replace).toHaveBeenCalledWith("?tab=score", { scroll: false });
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });

  it("sorts contributions, labels penalties, and discloses fallback use", async () => {
    params = new URLSearchParams("tab=score");
    renderWithClient(<EvidenceScoringWorkspace hotspotId="hotspot-1"/>);
    await screen.findByRole("heading", { name: "Score Breakdown" });
    const headings = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(headings.indexOf("Infrastructure gap")).toBeLessThan(headings.indexOf("Reported severity"));
    expect(screen.getAllByText(/Reduced the component score/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Estimate used—verify before approval").length).toBeGreaterThan(0);
  });

  it("does not merge repeated summaries without backend grouping metadata", async () => {
    params = new URLSearchParams("tab=citizen");
    renderWithClient(<EvidenceScoringWorkspace hotspotId="hotspot-1"/>);
    expect((await screen.findAllByText("Road flooding repeatedly blocks access during rainfall.")).length).toBe(2);
    expect(screen.getByText(/does not provide safe duplicate-group metadata/)).toBeInTheDocument();
  });

  it("renders backend canonical rank, readiness, and grouped multilingual evidence", async () => {
    Object.assign(evidenceFixture, {
      priority: { rank: 1, total_ranked: 4, band: "high", band_reason_code: "ACTION_SCORE_HIGH",
        ranking_scope: { country_code: "IN", category: null }, ranked_at: "2026-08-22T10:00:00Z", methodology_version: "priority-ranking-1.0.0" },
      evidence_readiness: { state: "review_with_caution", reason_codes: ["SYNTHETIC_SOURCE"], assessed_at: "2026-08-22T10:00:00Z", ruleset_version: "evidence-readiness-1.0.0" },
      evidence_groups: [{ group_id: "not-rendered", representative_summary: "Residents report recurring flooding.",
        representative_original_summary: "Moradores relatam alagamentos recorrentes.", original_language: "pt-BR", working_language: "en",
        report_count: 5, relationship: "probable_duplicate", evidence_types: ["text"], first_reported_at: "2026-08-01T10:00:00Z",
        last_reported_at: "2026-08-22T10:00:00Z", translation_performed: true }],
    });
    params = new URLSearchParams("tab=citizen");
    renderWithClient(<EvidenceScoringWorkspace hotspotId="hotspot-1"/>);
    expect(await screen.findByText("Theme found across 5 anonymized submissions")).toBeInTheDocument();
    expect(screen.getByText("Residents report recurring flooding.")).toHaveAttribute("lang", "en");
    fireEvent.click(screen.getByText("Show anonymized original-language summary"));
    expect(screen.getByText("Moradores relatam alagamentos recorrentes.")).toHaveAttribute("lang", "pt-BR");
    expect(document.body).not.toHaveTextContent("not-rendered");
    delete evidenceFixture.priority;
    delete evidenceFixture.evidence_readiness;
    delete evidenceFixture.evidence_groups;
  });

  it("renders structured affected components and deterministic reviewer action", async () => {
    evidenceFixture.limitations_structured = [{ code: "RECENT_TREND_FALLBACK", category: "estimated_value", severity: "warning",
      message: "Recent-trend data was unavailable.", affected_components: ["recent_trend"],
      reviewer_action_code: "VERIFY_RECENT_TREND_DATA", reviewer_action: "Verify recent administrative trend data before approval.", public_safe: true }];
    params = new URLSearchParams("tab=limitations");
    renderWithClient(<EvidenceScoringWorkspace hotspotId="hotspot-1"/>);
    expect(await screen.findByText("Recent-trend data was unavailable.")).toBeInTheDocument();
    expect(screen.getByText(/Affected components:/).closest("p")).toHaveTextContent("Recent trend");
    expect(screen.getByText(/Verify recent administrative trend data/)).toBeInTheDocument();
    delete evidenceFixture.limitations_structured;
  });
});

describe("hotspot detail and quick explanation", () => {
  it("keeps the detail decision-focused and links to the evidence workspace", async () => {
    renderWithClient(<HotspotDetailWorkspace hotspotId="hotspot-1"/>);
    expect(await screen.findByRole("heading", { name: "Why this hotspot needs attention" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View evidence/ })).toHaveAttribute("href", "/command-center/hotspots/hotspot-1/evidence?tab=overview");
  });

  it("opens explicitly, closes with Escape, and restores focus", async () => {
    renderWithClient(<QuickScoreExplanation hotspotId="hotspot-1" actionScore={40} bundle={evidenceFixture}/>);
    const trigger = screen.getByRole("button", { name: /How is the Action Score/ });
    trigger.focus(); fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

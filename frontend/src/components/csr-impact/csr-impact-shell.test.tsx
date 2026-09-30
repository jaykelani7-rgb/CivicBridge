import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { policyApi } from "@/lib/api/policy";
import { CSRImpactShell } from "./csr-impact-shell";

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/lib/api/auth", () => ({ authApi: { me: vi.fn().mockResolvedValue({ user: { uid: "reviewer", role: "policymaker" } }) } }));
vi.mock("@/lib/api/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/policy")>();
  return { ...actual, policyApi: { ...actual.policyApi,
    recommendations: vi.fn().mockResolvedValue([]), projects: vi.fn().mockResolvedValue([]),
    createRecommendation: vi.fn().mockResolvedValue({ recommendation_id: "new-proposal" }),
    decide: vi.fn().mockResolvedValue({ decision_id: "decision-1", recommendation_id: "first", action: "request_evidence", decided_at: "2026-09-30T00:00:00Z" }),
  } };
});

it("keeps a draft when the decision drawer closes, clears it on selection, and submits only after confirmation", async () => {
  const base = { hotspot_id: "hotspot-1", evidence_bundle_id: "bundle-1", problem: "Flooding needs review.", proposed_intervention: "Assess drainage.", intended_beneficiaries: null, supporting_evidence_ids: ["source-1"], risks: [], missing_information: [], confidence: null, status: "under_review", ai_draft: true, human_approved: false, assigned_department: null, assigned_reviewer: null, created_at: "2026-09-30T00:00:00Z", updated_at: "2026-09-30T00:00:00Z", schema_version: "recommendation-1.0.0", processing_mode: "mock" };
  vi.mocked(policyApi.recommendations).mockResolvedValue([{ ...base, recommendation_id: "first", title: "First report" }, { ...base, recommendation_id: "second", title: "Second report" }]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CSRImpactShell /></QueryClientProvider>);
  await screen.findByRole("heading", { name: "First report" });
  fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
  fireEvent.change(screen.getByLabelText("Decision reason"), { target: { value: "Need a field survey" } });
  fireEvent.click(screen.getByRole("button", { name: "Close decision drawer" }));
  fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
  expect(screen.getByLabelText("Decision reason")).toHaveValue("Need a field survey");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Second report/ }));
  fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
  expect(screen.getByLabelText("Decision reason")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Decision reason"), { target: { value: "Need another survey" } });
  fireEvent.click(screen.getByRole("button", { name: "Request more evidence" }));
  expect(policyApi.decide).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Record decision" }));
  await waitFor(() => expect(policyApi.decide).toHaveBeenCalledWith("second", expect.objectContaining({ action: "request_evidence", reason: "Need another survey" })));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("carries selected hotspot evidence into an editable proposal and waits for an explicit create action", async () => {
  vi.mocked(policyApi.recommendations).mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CSRImpactShell context={{hotspotId:"hotspot-1", bundleId:"bundle-1", title:"Drainage · Locality", recommendationId:""}}/></QueryClientProvider>);
  await screen.findByText("No recommendations in this view");
  expect(screen.getByLabelText("Hotspot ID")).toHaveValue("hotspot-1");
  expect(screen.getByLabelText("Evidence bundle ID")).toHaveValue("bundle-1");
  expect(policyApi.createRecommendation).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Optional title"), {target:{value:"Review drainage evidence"}});
  fireEvent.click(screen.getByRole("button", {name:"Create under-review recommendation"}));
  await waitFor(() => expect(policyApi.createRecommendation).toHaveBeenCalledExactlyOnceWith({hotspot_id:"hotspot-1", evidence_bundle_id:"bundle-1", title:"Review drainage evidence"}));
});

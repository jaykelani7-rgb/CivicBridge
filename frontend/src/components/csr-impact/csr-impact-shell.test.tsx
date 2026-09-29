import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  } };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("carries selected hotspot evidence into an editable proposal and waits for an explicit create action", async () => {
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

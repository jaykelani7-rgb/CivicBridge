import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PublicLocaleProvider } from "@/components/providers/public-locale-provider";
import { authApi } from "@/lib/api/auth";
import { SiteHeader } from "./site-header";

const route = vi.hoisted(() => ({ pathname: "/", replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useRouter: () => route }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/lib/api/auth", async (original) => {
  const actual = await original<typeof import("@/lib/api/auth")>();
  return { ...actual, authApi: { ...actual.authApi, me: vi.fn(), logout: vi.fn() } };
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PublicLocaleProvider><SiteHeader /></PublicLocaleProvider></QueryClientProvider>);
}

beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("does not flash staff sign-in while checking the verified session", async () => {
  vi.mocked(authApi.me).mockImplementation(() => new Promise(() => {}));
  mount();
  expect(screen.getByLabelText("Checking staff session")).toHaveAttribute("aria-busy", "true");
  expect(screen.queryByRole("link", { name: /Staff sign-in/i })).not.toBeInTheDocument();
});

it("links a verified policymaker to authorized workspaces with role information", async () => {
  vi.mocked(authApi.me).mockResolvedValue({ user: { uid: "p1", role: "policymaker", emailVerified: true } });
  mount();
  const workspace = await screen.findByRole("link", { name: "Open workspace" });
  expect(workspace).toHaveAttribute("href", "/command-center#overview");
  expect(screen.getByRole("navigation", { name: "Staff workspaces" })).toHaveTextContent("Recommendations");
  expect(screen.getByText("Verified role: policymaker")).toBeInTheDocument();
});

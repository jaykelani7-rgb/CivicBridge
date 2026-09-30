import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicLocaleProvider } from "@/components/providers/public-locale-provider";
import { MobileBottomNavigation, MobileNavItem } from "./mobile-bottom-navigation";
import { citizenNavigation, isMobileNavItemActive, navigationForRole, staffNavigation } from "@/lib/navigation/mobile-navigation";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a"> & { scroll?: boolean }) => { const { scroll, ...anchorProps } = props; void scroll; return <a {...anchorProps}>{children}</a>; } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined }); });

function wrapper(children: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PublicLocaleProvider>{children}</PublicLocaleProvider></QueryClientProvider>);
}

describe("mobile navigation configuration", () => {
  it("uses the required public citizen destinations without protected links", () => {
    expect(citizenNavigation.map(({ label, href }) => [label, href])).toEqual([["Home","/"],["Explore","/hotspots"],["Report","/volunteer"],["Track","/track"],["More","/more"]]);
    expect(citizenNavigation.some((item) => item.href.startsWith("/command-center") || item.href.startsWith("/csr-impact"))).toBe(false);
  });

  it.each([
    ["analyst", ["Overview","Hotspots","Review","Evidence","More"]],
    ["policymaker", ["Overview","Review","Policy","Projects","Impact"]],
    ["csr_partner", ["Overview","Projects","Impact","Explore","More"]],
    ["admin", ["Overview","Review","Policy","Projects","Impact"]],
  ] as const)("maps verified %s role destinations", (role, labels) => {
    expect(navigationForRole(role).map((item) => item.label)).toEqual(labels);
    expect(staffNavigation[role]).toBe(navigationForRole(role));
  });

  it("matches exact, nested, query-string, and hash destinations", () => {
    const hotspots = staffNavigation.analyst[1];
    expect(isMobileNavItemActive(hotspots, "/command-center", "#hotspots")).toBe(true);
    expect(isMobileNavItemActive(hotspots, "/command-center/detail?country=IN", "#hotspots")).toBe(true);
    expect(isMobileNavItemActive(hotspots, "/command-center?country=IN", "#review")).toBe(false);
    expect(isMobileNavItemActive(citizenNavigation[1], "/hotspots/detail?category=water")).toBe(true);
    expect(isMobileNavItemActive(staffNavigation.analyst[3], "/command-center/hotspots/h-1/evidence?tab=score")).toBe(true);
    expect(isMobileNavItemActive(hotspots, "/command-center/hotspots/h-1")).toBe(true);
  });
});

describe("MobileNavItem", () => {
  it("sets aria-current and keeps a 44px minimum touch target", () => {
    render(<MobileNavItem item={citizenNavigation[0]} active label="Home"/>);
    const link = screen.getByRole("link", { name: "Home" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.className).toContain("min-h-11");
  });

  it.each([[0, null], [12, "12"], [140, "99+"]] as const)("renders review badge count %s honestly", (count, value) => {
    const { container } = render(<MobileNavItem item={staffNavigation.analyst[2]} active={false} label="Review" reviewCount={count}/>);
    if (value) { expect(container).toHaveTextContent(value); expect(screen.getByRole("link")).toHaveAccessibleName(`Review, ${count} requests awaiting review.`); }
    else expect(screen.getByRole("link")).toHaveAccessibleName("Review");
  });
});

describe("MobileBottomNavigation", () => {
  beforeEach(() => { pathname = "/"; window.localStorage.clear(); vi.restoreAllMocks(); });

  it("does not flash citizen or staff tabs while the verified session is unresolved", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    wrapper(<MobileBottomNavigation/>);
    expect(screen.getByLabelText("Checking navigation access")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("falls back to public navigation after an unauthenticated session response and includes safe-area padding", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "AUTH_REQUIRED", message: "Sign in" } }), { status: 401, headers: { "Content-Type": "application/json" } })));
    wrapper(<MobileBottomNavigation/>);
    await screen.findByRole("link", { name: "Home" });
    const nav = screen.getByRole("navigation", { name: "Primary mobile navigation" });
    expect(nav).toHaveStyle({ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" });
    expect(nav.className).toContain("md:hidden");
  });

  it("hides while a modal is active and restores after it closes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "AUTH_REQUIRED", message: "Sign in" } }), { status: 401, headers: { "Content-Type": "application/json" } })));
    wrapper(<MobileBottomNavigation/>);
    await screen.findByRole("link", { name: "Home" });
    const dialog = document.createElement("div"); dialog.setAttribute("aria-modal", "true"); document.body.append(dialog);
    await waitFor(() => expect(screen.getByRole("navigation").className).toContain("hidden"));
    dialog.remove();
    await waitFor(() => expect(screen.getByRole("navigation").className).toContain("block"));
  });

  it("hides while a software keyboard reduces the visual viewport", async () => {
    const viewport = new EventTarget() as VisualViewport;
    Object.defineProperty(viewport, "height", { configurable: true, value: 480 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "AUTH_REQUIRED", message: "Sign in" } }), { status: 401, headers: { "Content-Type": "application/json" } })));
    wrapper(<><input aria-label="Report details"/><MobileBottomNavigation/></>);
    await screen.findByRole("link", { name: "Home" });
    screen.getByRole("textbox", { name: "Report details" }).focus();
    viewport.dispatchEvent(new Event("resize"));
    await waitFor(() => expect(screen.getByRole("navigation").className).toContain("hidden"));
  });
});

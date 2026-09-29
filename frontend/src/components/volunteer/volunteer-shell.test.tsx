import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicLocaleProvider } from "@/components/providers/public-locale-provider";
import { VolunteerShell } from "./volunteer-shell";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => "/volunteer" }));

describe("Citizen Portal accessibility", () => {
  it("uses a three-step flow and country changes never create location", () => {
    render(<QueryClientProvider client={new QueryClient()}><PublicLocaleProvider><VolunteerShell/></PublicLocaleProvider></QueryClientProvider>);
    expect(screen.getByRole("heading", { name: /What needs attention in your neighbourhood/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
    expect(screen.getByLabelText("Describe the issue")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "BR" } });
    fireEvent.change(screen.getByLabelText("Describe the issue"), { target: { value: "Blocked public drain" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue to location/i }));
    expect(screen.getByText("No browser location added")).toBeInTheDocument();
    expect(screen.getByText(/Country selection never creates coordinates/i)).toBeInTheDocument();
  });
});

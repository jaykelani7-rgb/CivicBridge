import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VolunteerShell } from "./volunteer-shell";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

describe("Citizen Portal accessibility", () => {
  it("uses a three-step flow and country changes never create location", () => {
    render(<QueryClientProvider client={new QueryClient()}><VolunteerShell/></QueryClientProvider>);
    expect(screen.getByRole("heading", { name: /Public Infrastructure Request/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
    expect(screen.getByLabelText("Written report alternative")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "BR" } });
    fireEvent.change(screen.getByLabelText("Written report alternative"), { target: { value: "Blocked public drain" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue to location/i }));
    expect(screen.getByText("No browser location added")).toBeInTheDocument();
    expect(screen.getByText(/Country selection never creates coordinates/i)).toBeInTheDocument();
  });
});

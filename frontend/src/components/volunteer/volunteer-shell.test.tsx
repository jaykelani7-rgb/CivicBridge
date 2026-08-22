import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VolunteerShell } from "./volunteer-shell";

describe("Citizen Portal accessibility", () => {
  it("exposes labelled core controls and consent", () => {
    render(<QueryClientProvider client={new QueryClient()}><VolunteerShell/></QueryClientProvider>);
    expect(screen.getByRole("heading", { name: /Public Infrastructure Request/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
    expect(screen.getByLabelText("Written report")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit request/i })).toBeInTheDocument();
  });
});

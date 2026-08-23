import { describe, expect, it } from "vitest";
import { translateStaticText } from "./static-ui-translations";

describe("translateStaticText", () => {
  it("translates interface text into Hindi and Portuguese", () => {
    expect(translateStaticText("Track a submitted report", "hi")).toBe("भेजी गई रिपोर्ट ट्रैक करें");
    expect(translateStaticText("Track a submitted report", "pt")).toBe("Acompanhar relato enviado");
  });

  it("preserves whitespace and leaves backend content outside the catalog unchanged", () => {
    expect(translateStaticText("  Request status\n", "hi")).toBe("  अनुरोध की स्थिति\n");
    expect(translateStaticText("Road flooding repeatedly blocks access during rainfall.", "pt")).toBe("Road flooding repeatedly blocks access during rainfall.");
  });

  it("translates dynamic step labels without translating identifiers", () => {
    expect(translateStaticText("Step 2 · Locate & attach", "hi")).toBe("चरण 2 · स्थान और संलग्नक");
    expect(translateStaticText("Tracking 7f0725b4", "pt")).toBe("Acompanhando 7f0725b4");
  });

  it("translates the Evidence & Scoring workspace navigation", () => {
    expect(translateStaticText("Evidence & Scoring", "hi")).toBe("प्रमाण और स्कोरिंग");
    expect(translateStaticText("Score Breakdown", "pt")).toBe("Detalhamento da pontuação");
    expect(translateStaticText("Technical details", "hi")).toBe("तकनीकी विवरण");
    expect(translateStaticText("6 privacy-safe requests are grouped under drainage in Ward 42.", "pt")).toContain("6 solicitações protegidas");
    expect(translateStaticText("The hotspot's strongest recorded influences are infrastructure gap and reported severity. Evidence is high confidence.", "hi")).not.toContain("strongest recorded influences");
  });
});

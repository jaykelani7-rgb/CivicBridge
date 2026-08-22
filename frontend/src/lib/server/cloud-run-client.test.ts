import { describe, expect, it } from "vitest";
import { messageFromFastApi, shouldAttachIdToken } from "./cloud-run-client";

describe("Cloud Run client boundaries", () => {
  it("authenticates Cloud Run HTTPS targets but not local HTTP by default", () => {
    expect(shouldAttachIdToken("https://service-abc-uc.a.run.app", "auto")).toBe(true);
    expect(shouldAttachIdToken("http://127.0.0.1:8000", "auto")).toBe(false);
    expect(shouldAttachIdToken("https://example.com", "always")).toBe(true);
  });

  it("parses canonical and FastAPI detail errors", () => {
    expect(messageFromFastApi({ error: { code: "NOPE", message: "Not found", retryable: false, trace_id: "t" } }, "fallback")).toMatchObject({ code: "NOPE", message: "Not found", traceId: "t" });
    expect(messageFromFastApi({ detail: [{ loc: ["body", "country_code"], msg: "unsupported" }] }, "fallback").message).toContain("body.country_code");
    expect(messageFromFastApi({ detail: { error: { code: "INVALID", message: "Bad request" } } }, "fallback")).toMatchObject({ code: "INVALID", message: "Bad request" });
  });
});

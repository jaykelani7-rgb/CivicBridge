import { describe, expect, it } from "vitest";
import { copyGoogleAuthHeaders, messageFromFastApi, shouldAttachIdToken } from "./cloud-run-client";

describe("Cloud Run client boundaries", () => {
  it("authenticates Cloud Run HTTPS targets but not local HTTP by default", () => {
    expect(shouldAttachIdToken("https://service-abc-uc.a.run.app", "auto")).toBe(true);
    expect(shouldAttachIdToken("http://127.0.0.1:8000", "auto")).toBe(false);
    expect(shouldAttachIdToken("https://example.com", "always")).toBe(true);
  });

  it("copies the non-enumerable authorization header returned by google-auth-library v11", () => {
    const googleHeaders = new Headers({ authorization: "Bearer test-id-token" });
    const outgoingHeaders = new Headers({ "X-Trace-Id": "trace-1" });
    expect(Object.entries(googleHeaders)).toHaveLength(0);

    copyGoogleAuthHeaders(outgoingHeaders, googleHeaders);

    expect(outgoingHeaders.get("authorization")).toBe("Bearer test-id-token");
    expect(outgoingHeaders.get("X-Trace-Id")).toBe("trace-1");
  });

  it("parses canonical and FastAPI detail errors", () => {
    expect(messageFromFastApi({ error: { code: "NOPE", message: "Not found", retryable: false, trace_id: "t" } }, "fallback")).toMatchObject({ code: "NOPE", message: "Not found", traceId: "t" });
    expect(messageFromFastApi({ detail: [{ loc: ["body", "country_code"], msg: "unsupported" }] }, "fallback").message).toContain("body.country_code");
    expect(messageFromFastApi({ detail: { error: { code: "INVALID", message: "Bad request" } } }, "fallback")).toMatchObject({ code: "INVALID", message: "Bad request" });
  });
});

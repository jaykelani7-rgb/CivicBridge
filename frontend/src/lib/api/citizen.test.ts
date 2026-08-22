import { afterEach, describe, expect, it, vi } from "vitest";
import { citizenApi } from "./citizen";
import { nextCitizenPollDelay } from "./polling";

describe("citizen media and polling", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("uploads the original media through same-origin multipart", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(FormData);
      expect((init?.body as FormData).get("file")).toBeInstanceOf(File);
      return new Response(JSON.stringify({ request_id: "r", media_ref: "private://media/r", filename: "voice.webm", size_bytes: 3, status: "uploaded" }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    await citizenApi.upload("r", new Blob(["abc"], { type: "audio/webm" }), "voice.webm");
    expect(fetchMock).toHaveBeenCalledWith("/api/citizen/requests/r/media", expect.objectContaining({ method: "POST" }));
  });

  it("terminates polling on terminal stages, pause, and attempt bound", () => {
    expect(nextCitizenPollDelay("normalizing", 2, true)).toBe(4000);
    expect(nextCitizenPollDelay("project_active", 2, true)).toBe(false);
    expect(nextCitizenPollDelay("normalizing", 8, true)).toBe(false);
    expect(nextCitizenPollDelay("normalizing", 2, false)).toBe(false);
  });
});

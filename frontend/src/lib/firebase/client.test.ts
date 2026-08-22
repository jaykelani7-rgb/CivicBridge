import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
  setPersistence: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));

vi.mock("firebase/app", () => ({ getApps: firebaseMocks.getApps, initializeApp: firebaseMocks.initializeApp }));
vi.mock("firebase/auth", () => ({
  getAuth: firebaseMocks.getAuth,
  setPersistence: firebaseMocks.setPersistence,
  connectAuthEmulator: firebaseMocks.connectAuthEmulator,
  inMemoryPersistence: { type: "NONE" },
}));

import { browserFirebaseAuth, resetFirebaseClientForTests, runtimeFirebaseConfig } from "./client";

const runtimeResponse = {
  apiKey: "runtime-api-key",
  authDomain: "civicbridge-1.firebaseapp.com",
  projectId: "civicbridge-1",
  appId: "1:987654:web:runtime",
  messagingSenderId: "987654",
  emailPasswordEnabled: true,
};

describe("runtime Firebase browser initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFirebaseClientForTests();
    firebaseMocks.getApps.mockReturnValue([]);
    firebaseMocks.initializeApp.mockReturnValue({ name: "civicbridge-browser" });
    firebaseMocks.getAuth.mockReturnValue({ name: "runtime-auth" });
    firebaseMocks.setPersistence.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(runtimeResponse), { status: 200, headers: { "Content-Type": "application/json" } })));
  });

  it("fetches the same-origin runtime response once and initializes Firebase with it", async () => {
    await expect(runtimeFirebaseConfig()).resolves.toEqual(runtimeResponse);
    const auth = await browserFirebaseAuth();
    await runtimeFirebaseConfig();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/auth/config", { credentials: "same-origin", cache: "no-store" });
    expect(firebaseMocks.initializeApp).toHaveBeenCalledWith({
      apiKey: "runtime-api-key",
      authDomain: "civicbridge-1.firebaseapp.com",
      projectId: "civicbridge-1",
      appId: "1:987654:web:runtime",
      messagingSenderId: "987654",
    }, "civicbridge-browser");
    expect(auth).toEqual({ name: "runtime-auth" });
  });

  it("rejects an invalid runtime response with a safe configuration error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...runtimeResponse, projectId: "" }), { status: 200 })));
    resetFirebaseClientForTests();
    await expect(runtimeFirebaseConfig()).rejects.toThrow("Staff sign-in is not configured correctly");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { Sandbox } from "../../src/sandbox.js";

describe("Exposures", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates preview URLs through the sandbox exposure namespace", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sandboxID: "sbx_123" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "exp_123",
            sandboxId: "sbx_123",
            port: 3000,
            hostname: "brisk-lotus-1a2b3c4d.omnirun-preview.dev",
            url: "https://brisk-lotus-1a2b3c4d.omnirun-preview.dev/app",
            visibility: "public",
            status: "pending",
            createdAt: "2026-03-12T00:00:00Z",
            expiresAt: "2026-03-12T01:00:00Z",
            openPath: "/app",
            preserveHost: false,
          }),
          {
            status: 201,
            headers: { "content-type": "application/json" },
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const sandbox = await Sandbox.create("node-22", {
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
    });
    const exposure = await sandbox.exposures.create(3000, {
      ttlSeconds: 900,
      openPath: "/app",
      preserveHost: false,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body).toMatchObject({
      port: 3000,
      requestedTtlSeconds: 900,
      openPath: "/app",
      preserveHost: false,
    });
    expect(exposure.id).toBe("exp_123");
    expect(exposure.url).toContain(".omnirun-preview.dev/app");
  });

  it("lists and closes preview URLs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sandboxID: "sbx_123" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "exp_123",
              sandboxId: "sbx_123",
              port: 5173,
              hostname: "preview.omnirun.dev",
              url: "https://preview.omnirun.dev",
              visibility: "public",
              status: "ready",
              createdAt: "2026-03-12T00:00:00Z",
              expiresAt: "2026-03-12T01:00:00Z",
              preserveHost: true,
            },
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const sandbox = await Sandbox.create("node-22", {
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
    });
    const exposures = await sandbox.exposures.list();
    await sandbox.exposures.close("exp_123");

    expect(exposures).toHaveLength(1);
    expect(exposures[0]?.status).toBe("ready");
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      "/sandboxes/sbx_123/exposures/exp_123"
    );
    expect((fetchMock.mock.calls[2][1] as RequestInit)?.method).toBe("DELETE");
  });
});

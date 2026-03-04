import { afterEach, describe, expect, it, vi } from "vitest";
import { HTTPClient } from "../../src/client.js";

const config = {
  apiUrl: "https://api.omnirun.io",
  apiKey: "test-key",
  requestTimeout: 30_000,
};

describe("HTTPClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends X-API-Key header on GET", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HTTPClient(config);
    await client.get("/health");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe("test-key");
  });

  it("normalizes JSON error responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "invalid request" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HTTPClient(config);
    await expect(client.get("/sandboxes")).rejects.toThrow(
      "API error 400: invalid request"
    );
  });

  it("normalizes plain-text error responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("upstream failed", {
        status: 502,
        headers: { "content-type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HTTPClient(config);
    await expect(client.get("/sandboxes")).rejects.toThrow(
      "API error 502: upstream failed"
    );
  });

  it("returns undefined for 204 responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HTTPClient(config);
    const result = await client.post<void>("/noop", {});
    expect(result).toBeUndefined();
  });
});

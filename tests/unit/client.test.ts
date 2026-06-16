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
    // 502 is retryable, so each attempt must receive a fresh Response
    // (a real server returns a distinct response body per request).
    const fetchMock = vi.fn().mockImplementation(
      async () =>
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

  it("retries GET once on a transient 503 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("temporarily unavailable", {
          status: 503,
          headers: { "content-type": "text/plain" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HTTPClient(config);
    const result = await client.get<{ ok: boolean }>("/sandboxes/sbx-1");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("GET");
  });

  it("does not retry GET on a 4xx error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "bad request" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HTTPClient(config);
    await expect(client.get("/sandboxes/sbx-1")).rejects.toThrow(
      "API error 400: bad request"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries DELETE once on a transient 502 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("bad gateway", {
          status: 502,
          headers: { "content-type": "text/plain" },
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new HTTPClient(config);
    await expect(client.delete("/sandboxes/sbx-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });

  it("does not retry DELETE on a 4xx error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("forbidden", {
        status: 403,
        headers: { "content-type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HTTPClient(config);
    await expect(client.delete("/sandboxes/sbx-1")).rejects.toThrow(
      "API error 403: forbidden"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

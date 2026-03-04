import { afterEach, describe, expect, it, vi } from "vitest";
import { HTTPClient } from "../../src/client.js";
import { Contexts } from "../../src/contexts.js";

describe("Contexts contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses POST SSE for stream-execute", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          'data: {"type":"stdout","data":"hello"}',
          "",
          'data: {"type":"done","execution_count":1}',
          "",
        ].join("\n"),
        {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HTTPClient({
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
      requestTimeout: 30_000,
    });

    const contexts = new Contexts("sandbox-1", client);
    const stdout: string[] = [];

    await contexts.execute("ctx-1", "print('hello')", {
      onStdout: (chunk) => stdout.push(chunk),
    });

    expect(stdout).toEqual(["hello"]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/sandboxes/sandbox-1/contexts/ctx-1/stream-execute");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ code: "print('hello')" }));
  });
});

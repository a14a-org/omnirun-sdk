import { afterEach, describe, expect, it, vi } from "vitest";
import { HTTPClient } from "../../src/client.js";
import { Commands } from "../../src/commands.js";
import { Filesystem } from "../../src/filesystem.js";
import { Webhooks } from "../../src/webhooks.js";

const config = {
  apiUrl: "https://api.omnirun.io",
  apiKey: "test-key",
  requestTimeout: 30_000,
};

describe("Route contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses expected command endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ stdout: "", stderr: "", exit_code: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const commands = new Commands("sbx-1", new HTTPClient(config));
    await commands.run("echo ok");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/sandboxes/sbx-1/commands");
    expect(init.method).toBe("POST");
  });

  it("uses expected file read endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: "hello" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const fs = new Filesystem("sbx-1", new HTTPClient(config));
    await fs.read("/tmp/hello.txt");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/sandboxes/sbx-1/files?path=%2Ftmp%2Fhello.txt");
    expect(init.method).toBe("GET");
  });

  it("uses expected webhooks endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "wh_1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const webhooks = new Webhooks(new HTTPClient(config));
    await webhooks.register("https://example.com/hook", ["created"]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/webhooks");
    expect(init.method).toBe("POST");
  });
});

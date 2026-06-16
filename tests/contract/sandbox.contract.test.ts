import { afterEach, describe, expect, it, vi } from "vitest";
import { Sandbox } from "../../src/sandbox.js";

describe("Sandbox contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes memory as memoryMB in the create payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sandboxID: "sbx_mem_1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await Sandbox.create("python-3.11", {
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
      memory: 2048,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.memoryMB).toBe(2048);
  });

  it("omits memoryMB from the create payload when memory is not set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sandboxID: "sbx_mem_2" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await Sandbox.create("python-3.11", {
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload).not.toHaveProperty("memoryMB");
  });

  it("uses the configured previewDomain for getHost()", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sandboxID: "sbx_host_1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const sbx = await Sandbox.create("python-3.11", {
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
      previewDomain: "preview.example.com",
    });

    expect(sbx.getHost(8080)).toBe("https://sbx_host_1-8080.preview.example.com");
  });

  it("defaults getHost() to a non-claudebox preview domain", async () => {
    const prev = process.env.OMNIRUN_PREVIEW_DOMAIN;
    delete process.env.OMNIRUN_PREVIEW_DOMAIN;
    try {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ sandboxID: "sbx_host_2" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      const sbx = await Sandbox.create("python-3.11", {
        apiUrl: "https://api.omnirun.io",
        apiKey: "test-key",
      });

      const host = sbx.getHost(8080);
      expect(host).not.toContain("claudebox.io");
      expect(host).toBe("https://sbx_host_2-8080.omnirun-preview.dev");
    } finally {
      if (prev === undefined) delete process.env.OMNIRUN_PREVIEW_DOMAIN;
      else process.env.OMNIRUN_PREVIEW_DOMAIN = prev;
    }
  });

  it("encodes metadata filter as metadata=key:value", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await Sandbox.list({
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
      metadata: { env: "prod" },
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("metadata=env%3Aprod");
    expect(url).not.toContain("metadata.env");
  });

  it("encodes paginator metadata using backend metadata query format", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-next-token": "",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const paginator = Sandbox.paginate({
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
      metadata: { team: "runtime" },
      limit: 10,
    });
    await paginator.nextItems();

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("metadata=team%3Aruntime");
    expect(url).not.toContain("metadata.team");
  });
});

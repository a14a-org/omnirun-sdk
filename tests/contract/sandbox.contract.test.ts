import { afterEach, describe, expect, it, vi } from "vitest";
import { SandboxNotFoundError } from "../../src/errors.js";
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

  it("throws from deprecated getHost() when no preview domain is configured", async () => {
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

      expect(() => sbx.getHost(8080)).toThrow(/getPreviewUrl/);
    } finally {
      if (prev === undefined) delete process.env.OMNIRUN_PREVIEW_DOMAIN;
      else process.env.OMNIRUN_PREVIEW_DOMAIN = prev;
    }
  });

  it("throws SandboxNotFoundError when connect gets a 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      Sandbox.connect("sbx_missing", {
        apiUrl: "https://api.omnirun.io",
        apiKey: "test-key",
      })
    ).rejects.toBeInstanceOf(SandboxNotFoundError);
  });

  it("throws SandboxNotFoundError when getInfo gets a 404", async () => {
    const okResponse = () =>
      new Response(JSON.stringify({ sandboxID: "sbx_1", state: "running" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const notFoundResponse = () =>
      new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse()) // connect()
      .mockResolvedValueOnce(notFoundResponse()); // getInfo()
    vi.stubGlobal("fetch", fetchMock);

    const sbx = await Sandbox.connect("sbx_1", {
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
    });

    await expect(sbx.getInfo()).rejects.toBeInstanceOf(SandboxNotFoundError);
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

  it("passes sniProxy through in the create network policy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sandboxID: "sbx_net_1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await Sandbox.create("python-3.11", {
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
      network: { allowDomains: ["api.example.com"], sniProxy: true },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.network).toEqual({ allowDomains: ["api.example.com"], sniProxy: true });
  });

  it("rejects sniProxy in setNetworkPolicy() instead of letting the server drop it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sandboxID: "sbx_net_2" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const sbx = await Sandbox.create("python-3.11", {
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
    });

    await expect(
      sbx.setNetworkPolicy({ allowDomains: ["api.example.com"], sniProxy: true })
    ).rejects.toThrow(/Sandbox.create/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

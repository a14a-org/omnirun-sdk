import { afterEach, describe, expect, it, vi } from "vitest";
import { Sandbox } from "../../src/sandbox.js";

describe("Sandbox contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

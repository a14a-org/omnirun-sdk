import { afterEach, describe, expect, it, vi } from "vitest";
import { Sandbox } from "../../src/sandbox.js";

describe("E2EE create contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends clientPublicKey when e2ee is enabled with provided keypair", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          sandboxID: "sbx_e2ee_1",
          serverPublicKey: "server-public-key",
        }),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const keyPair = {
      algorithm: "ECDH-P256" as const,
      publicKey: {} as CryptoKey,
      privateKey: {} as CryptoKey,
      publicKeyBase64: "client-public-key",
    };

    const sbx = await Sandbox.create("python-3.11", {
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
      e2ee: {
        enabled: true,
        keyPair,
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(payload.e2ee).toBe(true);
    expect(payload.clientPublicKey).toBe("client-public-key");

    expect(sbx.e2ee?.enabled).toBe(true);
    expect(sbx.e2ee?.clientPublicKey).toBe("client-public-key");
    expect(sbx.e2ee?.serverPublicKey).toBe("server-public-key");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { generateE2EEKeyPair } from "../../src/e2ee.js";
import { Sandbox } from "../../src/sandbox.js";

const hasWebCrypto = typeof globalThis.crypto?.subtle !== "undefined";

describe("E2EE create contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.skipIf(!hasWebCrypto)("sends clientPublicKey when e2ee is enabled with provided keypair", async () => {
    const clientKeyPair = await generateE2EEKeyPair();
    const serverKeyPair = await generateE2EEKeyPair();

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          sandboxID: "sbx_e2ee_1",
          serverPublicKey: serverKeyPair.publicKeyBase64,
        }),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const sbx = await Sandbox.create("python-3.11", {
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
      e2ee: {
        enabled: true,
        keyPair: clientKeyPair,
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(payload.e2ee).toBe(true);
    expect(payload.clientPublicKey).toBe(clientKeyPair.publicKeyBase64);

    expect(sbx.e2ee?.enabled).toBe(true);
    expect(sbx.e2ee?.clientPublicKey).toBe(clientKeyPair.publicKeyBase64);
    expect(sbx.e2ee?.serverPublicKey).toBe(serverKeyPair.publicKeyBase64);
  });
});

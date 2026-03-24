import { describe, expect, it } from "vitest";
import {
  decryptE2EEJSON,
  deriveE2EESharedKey,
  encryptE2EEJSON,
  generateE2EEKeyPair,
} from "../../src/e2ee.js";

const hasWebCrypto = typeof globalThis.crypto?.subtle !== "undefined";

describe("E2EE helpers", () => {
  it.skipIf(!hasWebCrypto)("generates keypair and roundtrips encrypted payload", async () => {
    const client = await generateE2EEKeyPair();
    const server = await generateE2EEKeyPair();

    expect(client.publicKeyBase64.length).toBeGreaterThan(40);

    const clientShared = await deriveE2EESharedKey(
      client.privateKey,
      server.publicKeyBase64
    );
    const serverShared = await deriveE2EESharedKey(
      server.privateKey,
      client.publicKeyBase64
    );

    const envelope = await encryptE2EEJSON(clientShared, {
      hello: "world",
      answer: 42,
    });

    const decrypted = await decryptE2EEJSON<{ hello: string; answer: number }>(
      serverShared,
      envelope
    );

    expect(decrypted.hello).toBe("world");
    expect(decrypted.answer).toBe(42);
  });
});

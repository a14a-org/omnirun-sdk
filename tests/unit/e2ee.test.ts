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

  it.skipIf(!hasWebCrypto)("round-trip encrypt/decrypt preserves nested JSON", async () => {
    const client = await generateE2EEKeyPair();
    const server = await generateE2EEKeyPair();

    const sharedKey = await deriveE2EESharedKey(
      client.privateKey,
      server.publicKeyBase64
    );
    const peerKey = await deriveE2EESharedKey(
      server.privateKey,
      client.publicKeyBase64
    );

    const original = {
      users: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }],
      meta: { page: 1, total: 100 },
      active: true,
    };

    const envelope = await encryptE2EEJSON(sharedKey, original);
    const decrypted = await decryptE2EEJSON<typeof original>(peerKey, envelope);

    expect(decrypted).toEqual(original);
  });

  it.skipIf(!hasWebCrypto)("encrypted envelope has expected structure", async () => {
    const client = await generateE2EEKeyPair();
    const server = await generateE2EEKeyPair();

    const sharedKey = await deriveE2EESharedKey(
      client.privateKey,
      server.publicKeyBase64
    );

    const envelope = await encryptE2EEJSON(sharedKey, { test: true });

    expect(envelope).toHaveProperty("alg", "AES-256-GCM");
    expect(envelope).toHaveProperty("nonce");
    expect(envelope).toHaveProperty("ciphertext");
    expect(typeof envelope.nonce).toBe("string");
    expect(typeof envelope.ciphertext).toBe("string");
    expect(envelope.nonce.length).toBeGreaterThan(0);
    expect(envelope.ciphertext.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasWebCrypto)("decrypt with wrong key fails", async () => {
    const client = await generateE2EEKeyPair();
    const server = await generateE2EEKeyPair();
    const wrongParty = await generateE2EEKeyPair();

    const sharedKey = await deriveE2EESharedKey(
      client.privateKey,
      server.publicKeyBase64
    );

    const wrongKey = await deriveE2EESharedKey(
      wrongParty.privateKey,
      server.publicKeyBase64
    );

    const envelope = await encryptE2EEJSON(sharedKey, { secret: "data" });

    await expect(decryptE2EEJSON(wrongKey, envelope)).rejects.toThrow();
  });
});

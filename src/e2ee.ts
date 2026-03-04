/**
 * E2EE protocol helpers (SDK-side scaffold).
 *
 * Current purpose:
 * - generate client key material
 * - send client public key during sandbox create
 * - provide envelope encryption helpers for future encrypted endpoints
 */

export type E2EEAlgorithm = "ECDH-P256";

export interface E2EEKeyPairMaterial {
  algorithm: E2EEAlgorithm;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  /** Base64-encoded SPKI public key sent to OmniRun create endpoint. */
  publicKeyBase64: string;
}

export interface E2EECreateOptions {
  /** Enable E2EE bootstrap on sandbox create. */
  enabled?: boolean;
  /** Optional pre-generated keypair. If omitted, SDK generates one. */
  keyPair?: E2EEKeyPairMaterial;
  /** Optional explicit public key string if key material is managed externally. */
  clientPublicKey?: string;
}

export interface E2EESessionInfo {
  enabled: boolean;
  clientPublicKey: string;
  clientKeyPair?: E2EEKeyPairMaterial;
  /** Optional server public key returned by API for handshake completion. */
  serverPublicKey?: string;
}

export interface EncryptedEnvelope {
  alg: "AES-256-GCM";
  nonce: string;
  ciphertext: string;
  aad?: string;
}

const ECDH_ALG: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };
const HKDF_ALG: HkdfParams = {
  name: "HKDF",
  hash: "SHA-256",
  salt: new Uint8Array(),
  info: new TextEncoder().encode("omnirun-e2ee-v1"),
};

function getCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error("WebCrypto is required for E2EE helpers (Node 18+ or modern browser)");
  }
  return c;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function generateE2EEKeyPair(): Promise<E2EEKeyPairMaterial> {
  const crypto = getCrypto();
  const keys = await crypto.subtle.generateKey(ECDH_ALG, true, ["deriveBits"]);
  const publicKey = keys.publicKey as CryptoKey;
  const privateKey = keys.privateKey as CryptoKey;
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", publicKey));

  return {
    algorithm: "ECDH-P256",
    publicKey,
    privateKey,
    publicKeyBase64: bytesToBase64(spki),
  };
}

export async function importE2EEPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const crypto = getCrypto();
  const spki = base64ToBytes(publicKeyBase64);
  return crypto.subtle.importKey("spki", toArrayBuffer(spki), ECDH_ALG, true, []);
}

export async function deriveE2EESharedKey(
  privateKey: CryptoKey,
  peerPublicKeyBase64: string
): Promise<CryptoKey> {
  const crypto = getCrypto();
  const peerKey = await importE2EEPublicKey(peerPublicKeyBase64);
  const bits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: peerKey },
    privateKey,
    256
  );

  const ikm = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    HKDF_ALG,
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptE2EEJSON(
  key: CryptoKey,
  payload: unknown,
  aad?: string
): Promise<EncryptedEnvelope> {
  const crypto = getCrypto();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const additionalData = aad ? new TextEncoder().encode(aad) : undefined;
  const ivBuffer = toArrayBuffer(iv);
  const plaintextBuffer = toArrayBuffer(plaintext);
  const additionalDataBuffer = additionalData ? toArrayBuffer(additionalData) : undefined;
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
      additionalData: additionalDataBuffer,
    },
    key,
    plaintextBuffer
  );

  return {
    alg: "AES-256-GCM",
    nonce: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    aad,
  };
}

export async function decryptE2EEJSON<T = unknown>(
  key: CryptoKey,
  envelope: EncryptedEnvelope
): Promise<T> {
  const crypto = getCrypto();
  const iv = base64ToBytes(envelope.nonce);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const additionalData = envelope.aad
    ? new TextEncoder().encode(envelope.aad)
    : undefined;
  const ivBuffer = toArrayBuffer(iv);
  const ciphertextBuffer = toArrayBuffer(ciphertext);
  const additionalDataBuffer = additionalData ? toArrayBuffer(additionalData) : undefined;

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
      additionalData: additionalDataBuffer,
    },
    key,
    ciphertextBuffer
  );

  const decoded = new TextDecoder().decode(new Uint8Array(plaintext));
  return JSON.parse(decoded) as T;
}

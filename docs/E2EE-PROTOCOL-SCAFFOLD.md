# E2EE Protocol Scaffold (SDK + API)

This document defines the initial protocol contract for encrypted-transport OmniRun
workloads. Today this provides encrypted transport to the sandbox (the worker
decrypts to execute); the steps required to reach true end-to-end confidentiality
are tracked in "Required backend follow-up" below.

## Current state

- SDK can now:
  - generate ephemeral client keypairs (`ECDH P-256`)
  - send `clientPublicKey` on sandbox create
  - expose encryption envelope helpers (`AES-256-GCM`)
- Backend currently treats this as a bootstrap signal unless encrypted endpoints are implemented.

> **Confidentiality scope:** payloads are encrypted in transit to the sandbox, but
> the worker decrypts them in order to execute commands and code. Confidentiality
> therefore terminates at the worker — this is encrypted transport, not
> zero-knowledge end-to-end encryption. The operator running the sandbox can observe
> decrypted payloads. The "Required backend follow-up" section below describes what
> would be needed to move decryption fully inside the VM agent.

## Create handshake

Client request (`POST /sandboxes`):

```json
{
  "template": "python-3.11",
  "timeout": 300,
  "e2ee": true,
  "clientPublicKey": "<base64-spki>"
}
```

Expected server response extension:

```json
{
  "sandboxID": "...",
  "serverPublicKey": "<base64-spki>"
}
```

Alternative response shape accepted by SDK:

```json
{
  "sandboxID": "...",
  "e2ee": {
    "serverPublicKey": "<base64-spki>"
  }
}
```

## Envelope format

Encrypted payload envelope:

```json
{
  "alg": "AES-256-GCM",
  "nonce": "<base64-12-byte-iv>",
  "ciphertext": "<base64-ciphertext+tag>",
  "aad": "<optional-associated-data>"
}
```

AAD should bind request context, e.g. `sandboxID:endpoint:sequence`.

## Required backend follow-up for real E2EE confidentiality

1. Agent-generated server keypair per sandbox/session.
2. Return `serverPublicKey` on create when `e2ee=true`.
3. Add encrypted variants for command/code/files endpoints.
4. Decrypt only inside VM agent, not in control-plane services.
5. Re-encrypt output in VM agent before returning.
6. Add replay protection (`sequence`, nonce discipline) and strict envelope validation.
7. Avoid plaintext body logging in every layer.
8. Optionally add attestation/key-binding for strong anti-MITM guarantees.

## SDK usage now

```ts
import { Sandbox } from "@omnirun/sdk";

const sbx = await Sandbox.create("python-3.11", {
  apiUrl: process.env.OMNIRUN_API_URL,
  apiKey: process.env.OMNIRUN_API_KEY,
  e2ee: true,
});

console.log(sbx.e2ee?.clientPublicKey);
console.log(sbx.e2ee?.serverPublicKey); // present once backend supports it
```

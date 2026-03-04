# @omnirun/sdk

TypeScript SDK for OmniRun sandboxes.

## Install

```bash
npm install @omnirun/sdk
pnpm add @omnirun/sdk
bun add @omnirun/sdk
```

## Configuration

The SDK resolves configuration in this order:

1. Explicit options passed to SDK methods.
2. Environment variables: `OMNIRUN_API_URL`, `OMNIRUN_API_KEY`.
3. Default API URL: `https://api.omnirun.io`.

## Quickstart

```ts
import { Sandbox } from "@omnirun/sdk";

const sbx = await Sandbox.create("python-3.11", {
  apiKey: process.env.OMNIRUN_API_KEY,
  apiUrl: process.env.OMNIRUN_API_URL,
  timeout: 300,
});

const result = await sbx.commands.run("python3 -c \"print('hello')\"");
console.log(result.stdout);

await sbx.kill();
```

## Files

```ts
await sbx.files.write("/tmp/input.txt", "hello");
const content = await sbx.files.read("/tmp/input.txt");
const bytes = await sbx.files.read("/tmp/input.txt", "bytes");
```

## Streaming

```ts
const command = await sbx.commands.run("for i in 1 2 3; do echo $i; sleep 1; done", {
  background: true,
});

for await (const event of command) {
  if (event.type === "stdout") {
    process.stdout.write(event.data ?? "");
  }
}
```

## Integration tests

Integration tests are opt-in:

```bash
OMNIRUN_API_URL=https://api.omnirun.io \
OMNIRUN_API_KEY=<key> \
RUN_OMNIRUN_INTEGRATION=1 \
npm run test:integration
```

## Hosted API smoke examples

```bash
OMNIRUN_API_URL=https://<your-api-host> \
OMNIRUN_API_KEY=<key> \
npm run examples:hosted
```

Hosted example suites live in `examples/hosted/`.

## E2EE scaffold (client key bootstrap)

The SDK can generate a client keypair and send `clientPublicKey` during sandbox creation:

```ts
import { Sandbox } from "@omnirun/sdk";

const sbx = await Sandbox.create("python-3.11", {
  apiUrl: process.env.OMNIRUN_API_URL,
  apiKey: process.env.OMNIRUN_API_KEY,
  e2ee: true,
});

console.log(sbx.e2ee?.clientPublicKey);
console.log(sbx.e2ee?.serverPublicKey); // available when backend returns it
```

Protocol scaffold details: `docs/E2EE-PROTOCOL-SCAFFOLD.md`.

## API Surface

- `Sandbox`
- `Commands` / `CommandHandle`
- `Filesystem`
- `Pty` / `PtySession`
- `Contexts`
- `Production`
- `Webhooks`

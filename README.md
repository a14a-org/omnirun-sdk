<p align="center">
  <a href="https://omnirun.io">
    <h1 align="center">@omnirun/sdk</h1>
  </a>
</p>

<p align="center">
  <strong>TypeScript SDK for OmniRun cloud sandboxes.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@omnirun/sdk"><img src="https://img.shields.io/npm/v/@omnirun/sdk" alt="npm"></a>
  <a href="https://omnirun.io/docs"><img src="https://img.shields.io/badge/docs-omnirun.io-blue" alt="Documentation"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
</p>

---

## Install

```bash
npm install @omnirun/sdk
```

## Quick Start

```ts
import { Sandbox } from "@omnirun/sdk";

// Create a sandbox (Firecracker microVM)
const sbx = await Sandbox.create("python-3.11", {
  apiKey: process.env.OMNIRUN_API_KEY,
});

// Run a command
const result = await sbx.commands.run("python3 -c \"print('hello from sandbox')\"");
console.log(result.stdout); // "hello from sandbox\n"

// Clean up
await sbx.kill();
```

## Desktop Sandbox

Control a full Linux desktop environment with mouse, keyboard, and screenshots.

```ts
const sbx = await Sandbox.create("desktop", {
  apiKey: process.env.OMNIRUN_API_KEY,
});

// Take a screenshot
const png = await sbx.desktop.screenshot();

// Click and type
await sbx.desktop.leftClick(100, 200);
await sbx.desktop.type("Hello world");
await sbx.desktop.press("Enter");

// Get screen dimensions
const screen = await sbx.desktop.getScreen();
console.log(`${screen.width}x${screen.height}`);

await sbx.kill();
```

## Encrypted Transport to the Sandbox

Bootstrap a client keypair and encrypt payloads in transit to the sandbox.

> **Confidentiality scope:** payloads are encrypted in transit and the worker
> decrypts them in order to execute commands and code. Confidentiality therefore
> terminates at the worker — this is encrypted transport, not zero-knowledge
> end-to-end encryption. The operator running the sandbox can observe decrypted
> payloads.

```ts
const sbx = await Sandbox.create("python-3.11", {
  apiKey: process.env.OMNIRUN_API_KEY,
  e2ee: true,
});

console.log(sbx.e2ee?.clientPublicKey);
console.log(sbx.e2ee?.serverPublicKey);
```

See `docs/E2EE-PROTOCOL-SCAFFOLD.md` for protocol details.

## Files

```ts
// Write and read files
await sbx.files.write("/tmp/input.txt", "hello");
const content = await sbx.files.read("/tmp/input.txt");
const bytes = await sbx.files.read("/tmp/input.txt", "bytes");

// Signed URLs for moving artifacts across the sandbox boundary
const uploadUrl = await sbx.uploadUrl("/tmp/report.json");
const downloadUrl = await sbx.downloadUrl("/tmp/report.json");
```

## Streaming

```ts
const command = await sbx.commands.run(
  "for i in 1 2 3; do echo $i; sleep 1; done",
  { background: true },
);

for await (const event of command) {
  if (event.type === "stdout") {
    process.stdout.write(event.data ?? "");
  }
}
```

## Production Controls

```ts
// Metrics
const metrics = await sbx.production.metrics();
const snapshots = await sbx.production.metricsSnapshots();
```

### Network policy (read the caveats)

Outbound network access from a sandbox is **open by default**. A network
policy only enforces a domain allowlist when you opt in to the SNI proxy, and
even then it covers **HTTPS (TCP/443) only**:

```ts
const sbx = await Sandbox.create("python-3.11", {
  network: {
    allowDomains: ["api.openai.com"],
    sniProxy: true, // required for allowDomains to be enforced
  },
});
```

- With `sniProxy: true`, outbound TCP/443 is routed through a TLS-SNI filter
  that only forwards hostnames in `allowDomains`. Plain HTTP (port 80), DNS,
  UDP and other TCP ports are **not** restricted by this policy, and
  `denyDomains` / `allowIPs` / `denyIPs` are ignored. The server must have the
  `omni-sniproxy` binary configured, otherwise sandbox creation fails.
- `sniProxyLogOnly: true` (with `sniProxy: true`) forwards everything and only
  logs observed hostnames, to help you build an allowlist.
- Without `sniProxy`, `allowDomains` is **not** an allowlist: domains and IPs
  are resolved to IP firewall rules that do not constrain the guest VM's own
  traffic. Do not rely on it for isolation.
- `sniProxy` is currently accepted only at creation. `sbx.production.setNetworkPolicy()`
  throws if you pass it, rather than silently applying nothing.

## Preview URLs

Use the exposures API to get a routable URL for a port inside the sandbox:

```ts
const url = await sbx.getPreviewUrl(3000); // reuses a live public exposure or creates one
const exposure = await sbx.expose(3000, { ttlSeconds: 900 }); // full ExposureInfo
```

`sbx.getHost(port)` is **deprecated**: it builds the legacy
`{sandboxId}-{port}.<domain>` hostname, which hosted OmniRun no longer routes.
It now has no default domain and throws unless you pass `previewDomain` (or set
`OMNIRUN_PREVIEW_DOMAIN`) for a self-hosted proxy that still serves that pattern.

## LLM Proxy

OpenAI-compatible LLM proxy with per-user spend tracking.

```ts
import { LLM } from "@omnirun/sdk";

const llm = new LLM({ apiKey: process.env.OMNIRUN_API_KEY });

// Chat completion
const response = await llm.chatCompletion({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);

// Streaming
for await (const chunk of llm.streamChatCompletion({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Tell me a joke" }],
})) {
  process.stdout.write(chunk);
}

// Usage tracking
const usage = await llm.getUsage();
console.log(`Remaining: ${usage.remainingCents / 100} USD`);
```

## API Overview

### Sandbox

| Method | Description |
|--------|-------------|
| `Sandbox.create(template, opts)` | Create a new sandbox |
| `Sandbox.connect(sandboxId, opts)` | Connect to an existing sandbox |
| `Sandbox.list(opts)` | List all sandboxes |
| `sbx.kill()` | Destroy the sandbox |

### Namespaces

| Namespace | Key Methods | Description |
|-----------|-------------|-------------|
| `sbx.commands` | `run()`, `list()` | Run shell commands, stream output |
| `sbx.files` | `read()`, `write()`, `list()`, `remove()` | Read, write, and manage files |
| `sbx.pty` | `create()`, `resize()`, `write()` | Interactive terminal (PTY) sessions |
| `sbx.contexts` | `create()`, `execute()` | Persistent interpreter contexts (REPL) |
| `sbx.desktop` | `screenshot()`, `leftClick()`, `type()`, `press()` | Desktop GUI interaction |
| `sbx.exposures` | `create()`, `list()`, `get()`, `refresh()`, `close()` | Port exposure and preview URLs (see also `sbx.getPreviewUrl()`) |
| `sbx.production` | `setNetworkPolicy()`, `metrics()` | Network policies and monitoring |
| `sbx.webhooks` | `create()`, `list()`, `delete()` | Webhook registration |
| `LLM` | `chatCompletion()`, `streamChatCompletion()`, `listModels()` | LLM inference gateway |

## Configuration

The SDK resolves configuration in this order:

1. Explicit options passed to SDK methods
2. Environment variables: `OMNIRUN_API_URL`, `OMNIRUN_API_KEY`
3. Default API URL: `https://api.omnirun.io`

## Related

- [Python SDK](https://github.com/a14a-org/omnirun-sdk-python) -- `pip install omnirun`
- [Examples](https://github.com/a14a-org/omnirun-examples) -- 11 practical examples
- [CLI](https://www.npmjs.com/package/@omnirun/cli) -- `npm install -g @omnirun/cli`
- [Documentation](https://omnirun.io/docs)

## License

MIT

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

## End-to-End Encryption (E2EE)

Bootstrap a client keypair and establish encrypted communication with the sandbox.

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
// Network policy
await sbx.production.setNetworkPolicy({
  allowDomains: ["api.openai.com"],
});

// Metrics
const metrics = await sbx.production.metrics();
const snapshots = await sbx.production.metricsSnapshots();
```

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
| `sbx.exposures` | `create()`, `list()`, `close()` | Port exposure and preview URLs |
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

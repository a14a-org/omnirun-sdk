import { run as preflight } from "./00-preflight.mjs";
import { run as lifecycle } from "./01-lifecycle.mjs";
import { run as commandsFiles } from "./02-commands-files.mjs";
import { run as streaming } from "./03-streaming.mjs";
import { run as contexts } from "./04-contexts.mjs";
import { run as pty } from "./05-pty.mjs";
import { run as secureMode } from "./06-secure-mode.mjs";
import { run as networkPolicy } from "./07-network-policy.mjs";

const suites = [
  ["preflight", preflight],
  ["lifecycle", lifecycle],
  ["commands-files", commandsFiles],
  ["streaming", streaming],
  ["contexts", contexts],
  ["network-policy", networkPolicy],
  ["secure-mode", secureMode],
  ["pty", pty],
];

async function main() {
  const only = process.argv[2] || "";

  for (const [name, fn] of suites) {
    if (only && name !== only) continue;
    const started = Date.now();
    try {
      await fn();
      console.log(`[pass] ${name} (${Date.now() - started}ms)`);
    } catch (err) {
      const message = err?.message || String(err);
      const cause = err?.cause?.message ? ` (cause: ${err.cause.message})` : "";
      console.error(`[fail] ${name}: ${message}${cause}`);
      process.exit(1);
    }
  }

  console.log("\nAll selected hosted examples passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

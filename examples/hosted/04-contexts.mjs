import { Sandbox } from "../../dist/index.js";
import { assertHostedEnv, step } from "./_config.mjs";

export async function run() {
  const { apiUrl, apiKey } = assertHostedEnv();
  step("contexts");

  const sbx = await Sandbox.create("python-3.11", {
    apiUrl,
    apiKey,
    timeout: 300,
    metadata: { suite: "hosted-examples", scenario: "contexts" },
  });

  try {
    const ctx = await sbx.contexts.create("python");
    console.log(`context_id=${ctx.id}`);

    const execResult = await sbx.contexts.execute(ctx.id, "print('ctx-ok')", {
      onStdout: (chunk) => process.stdout.write(`[ctx-stdout] ${chunk}`),
    });
    console.log(`\ncontext_results=${execResult.results.length}`);

    const contexts = await sbx.contexts.list();
    console.log(`contexts_listed=${contexts.length}`);

    await sbx.contexts.delete(ctx.id);
    console.log("context_deleted=true");
  } finally {
    await sbx.kill();
    console.log("sandbox_killed=true");
  }
}

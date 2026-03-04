import { Sandbox } from "../../dist/index.js";
import { assertHostedEnv, step } from "./_config.mjs";

export async function run() {
  const { apiUrl, apiKey } = assertHostedEnv();
  step("lifecycle");

  const sbx = await Sandbox.create("python-3.11", {
    apiUrl,
    apiKey,
    timeout: 300,
    metadata: { suite: "hosted-examples", scenario: "lifecycle" },
  });

  try {
    console.log(`sandbox_id=${sbx.sandboxId}`);

    const info = await sbx.getInfo();
    console.log(`state=${info.state} template=${info.templateId}`);

    await sbx.setTimeout(600);
    console.log("timeout_updated=600");

    const listed = await Sandbox.list({
      apiUrl,
      apiKey,
      metadata: { suite: "hosted-examples" },
      limit: 100,
    });
    const found = listed.some((s) => s.sandboxId === sbx.sandboxId);
    console.log(`listed_with_metadata_filter=${found}`);
    if (!found) {
      throw new Error("created sandbox was not returned by metadata filtered list");
    }
  } finally {
    await sbx.kill();
    console.log("sandbox_killed=true");
  }
}

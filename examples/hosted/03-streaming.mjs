import { Sandbox } from "../../dist/index.js";
import { assertHostedEnv, step } from "./_config.mjs";

export async function run() {
  const { apiUrl, apiKey } = assertHostedEnv();
  step("streaming command");

  const sbx = await Sandbox.create("python-3.11", {
    apiUrl,
    apiKey,
    timeout: 300,
    metadata: { suite: "hosted-examples", scenario: "streaming" },
  });

  try {
    const chunks = [];
    const result = await sbx.commands.run(
      "sleep 1; for i in 1 2 3; do echo stream-$i; sleep 0.5; done",
      {
        onStdout: (chunk) => chunks.push(chunk.trim()),
      }
    );

    console.log(`stream_chunks=${chunks.filter(Boolean).join(",")}`);
    console.log(`final_stdout=${result.stdout.replace(/\n/g, "|")}`);
    if (!result.stdout.includes("stream-3")) {
      throw new Error("expected streaming command output to include stream-3");
    }
  } finally {
    await sbx.kill();
    console.log("sandbox_killed=true");
  }
}

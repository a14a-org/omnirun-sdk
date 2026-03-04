import { Sandbox } from "../../dist/index.js";
import { assertHostedEnv, step } from "./_config.mjs";

export async function run() {
  const { apiUrl, apiKey } = assertHostedEnv();
  step("pty");

  const sbx = await Sandbox.create("python-3.11", {
    apiUrl,
    apiKey,
    timeout: 300,
    metadata: { suite: "hosted-examples", scenario: "pty" },
  });

  try {
    const session = await sbx.pty.create({ cols: 80, rows: 24 });
    await session.sendStdin("echo pty-ok\n");
    await new Promise((resolve) => setTimeout(resolve, 700));
    const output = await session.read();
    console.log(`pty_output_has_ok=${output.includes("pty-ok")}`);
    await session.kill();
  } finally {
    await sbx.kill();
    console.log("sandbox_killed=true");
  }
}

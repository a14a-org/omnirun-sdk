import { Sandbox } from "../../dist/index.js";
import { assertHostedEnv, step } from "./_config.mjs";

export async function run() {
  const { apiUrl, apiKey } = assertHostedEnv();
  step("commands + files");

  const sbx = await Sandbox.create("python-3.11", {
    apiUrl,
    apiKey,
    timeout: 300,
    metadata: { suite: "hosted-examples", scenario: "commands-files" },
  });

  try {
    const result = await sbx.commands.run("python3 -c \"print(6*7)\"");
    console.log(`command_stdout=${result.stdout.trim()}`);

    await sbx.files.write("/tmp/example.txt", "hello-from-sdk");
    const readBack = await sbx.files.read("/tmp/example.txt");
    console.log(`file_read_back=${readBack}`);

    const bytes = new TextEncoder().encode("binary-ok");
    await sbx.files.write("/tmp/example.bin", bytes);
    const raw = await sbx.files.read("/tmp/example.bin", "bytes");
    console.log(`binary_len=${raw.length}`);

    const exists = await sbx.files.exists("/tmp/example.txt");
    console.log(`file_exists=${exists}`);
    if (!exists) {
      throw new Error("expected /tmp/example.txt to exist");
    }
  } finally {
    await sbx.kill();
    console.log("sandbox_killed=true");
  }
}

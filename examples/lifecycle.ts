import { Sandbox } from "@omnirun/sdk";

async function main() {
  const sbx = await Sandbox.create("python-3.11", {
    apiKey: process.env.OMNIRUN_API_KEY,
    apiUrl: process.env.OMNIRUN_API_URL,
    timeout: 300,
  });

  try {
    const result = await sbx.commands.run("python3 -c \"print(42)\"");
    console.log(result.stdout.trim());
  } finally {
    await sbx.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

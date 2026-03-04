import { Sandbox } from "@omnirun/sdk";

async function main() {
  const sbx = await Sandbox.create("python-3.11", {
    apiKey: process.env.OMNIRUN_API_KEY,
    apiUrl: process.env.OMNIRUN_API_URL,
  });

  try {
    const handle = await sbx.commands.run("for i in 1 2 3; do echo $i; sleep 1; done", {
      background: true,
    });

    for await (const event of handle) {
      if (event.type === "stdout") {
        process.stdout.write(event.data ?? "");
      }
      if (event.type === "exit") {
        console.log(`\nexit=${event.exit_code ?? 0}`);
      }
    }
  } finally {
    await sbx.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

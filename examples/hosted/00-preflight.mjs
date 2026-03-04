import { assertApiUrl, step } from "./_config.mjs";

export async function run() {
  const { apiUrl } = assertApiUrl();
  step("preflight");

  const statusResp = await fetch(new URL("/status", apiUrl));
  if (!statusResp.ok) {
    throw new Error(`status check failed: ${statusResp.status}`);
  }

  const status = await statusResp.json();
  console.log(`api_url=${apiUrl}`);
  console.log(`node_id=${status.node_id}`);
  console.log(`active_sandboxes=${status.active_sandboxes}/${status.max_sandboxes}`);
  console.log(`templates=${Array.isArray(status.templates) ? status.templates.join(",") : "unknown"}`);
}

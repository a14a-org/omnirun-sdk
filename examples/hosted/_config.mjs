export function loadConfig() {
  const apiUrl = process.env.OMNIRUN_API_URL || "";
  const apiKey = process.env.OMNIRUN_API_KEY || "";
  const insecureTls = process.env.OMNIRUN_ALLOW_INSECURE_TLS === "1";
  if (insecureTls) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  return { apiUrl, apiKey, insecureTls };
}

export function assertApiUrl() {
  const { apiUrl } = loadConfig();
  if (!apiUrl) {
    throw new Error(
      "Missing OMNIRUN_API_URL. Example:\n" +
        "OMNIRUN_API_URL=https://<your-api-host> npm run examples:hosted -- preflight"
    );
  }
  return { apiUrl };
}

export function assertHostedEnv() {
  const { apiUrl, apiKey } = loadConfig();
  if (!apiUrl) {
    throw new Error(
      "Missing OMNIRUN_API_URL. Example:\n" +
        "OMNIRUN_API_URL=https://<your-api-host> OMNIRUN_API_KEY=<key> npm run examples:hosted"
    );
  }
  if (!apiKey) {
    throw new Error(
      "Missing OMNIRUN_API_KEY. Example:\n" +
        "OMNIRUN_API_URL=https://<your-api-host> OMNIRUN_API_KEY=<key> npm run examples:hosted"
    );
  }
  return { apiUrl, apiKey };
}

export function step(name) {
  process.stdout.write(`\n[example] ${name}\n`);
}

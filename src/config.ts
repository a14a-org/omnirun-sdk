/** Connection options for OmniRun API calls. */
export interface ConnectionConfig {
  apiUrl: string;
  apiKey: string;
  requestTimeout: number;
}

/** Resolves runtime config from explicit options, env vars, and defaults. */
export function resolveConfig(opts?: {
  apiUrl?: string;
  apiKey?: string;
  requestTimeout?: number;
}): ConnectionConfig {
  return {
    apiUrl:
      opts?.apiUrl ||
      (typeof process !== "undefined"
        ? process.env.OMNIRUN_API_URL
        : undefined) ||
      "https://api.omnirun.io",
    apiKey:
      opts?.apiKey ||
      (typeof process !== "undefined"
        ? process.env.OMNIRUN_API_KEY
        : undefined) ||
      "",
    requestTimeout: opts?.requestTimeout ?? 60_000,
  };
}

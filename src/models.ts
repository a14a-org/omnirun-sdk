import type { E2EECreateOptions } from "./e2ee.js";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** Alias for stdout (e2b compat). */
  readonly output?: string;
}

export interface EntryInfo {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

export interface SandboxInfo {
  sandboxId: string;
  templateId: string;
  status: string;
  startedAt: string;
  endAt?: string;
  name?: string;
  state?: string;
  cpuCount?: number;
  memoryMB?: number;
}

export interface ProcessInfo {
  pid: number;
  command: string;
  running: boolean;
  exitCode: number;
  stdout?: string;
  stderr?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface PtyInfo {
  pid: number;
  running: boolean;
  startedAt?: string;
}

export interface WriteEntry {
  path: string;
  content: string;
}

export interface FilesystemEvent {
  type: "create" | "write" | "remove" | "rename";
  path: string;
  name: string;
  timestamp?: string;
}

export interface StreamEvent {
  type: "stdout" | "stderr" | "exit";
  data?: string;
  exit_code?: number;
  timestamp?: string;
}

export interface FullSandboxInfo extends SandboxInfo {
  state: string;
  cpuCount: number;
  memoryMB: number;
}

export type ExposureVisibility = "public" | "private";

export type ExposureStatus =
  | "pending"
  | "ready"
  | "revoked"
  | "expired"
  | "sandbox_stopped"
  | "error";

/** Detailed information about a sandbox port exposure (preview URL). */
export interface ExposureInfo {
  /** Unique exposure identifier. */
  id: string;
  /** ID of the parent sandbox. */
  sandboxId: string;
  /** Account that owns the exposure. */
  accountId?: string;
  /** Sandbox-internal port being exposed. */
  port: number;
  /** Hostname of the exposure proxy. */
  hostname: string;
  /** Full public URL for the exposure. */
  url: string;
  /** URL with embedded access token for private exposures. */
  accessUrl?: string;
  /** Visibility level: `"public"` or `"private"`. */
  visibility: ExposureVisibility;
  /** Current lifecycle status of the exposure. */
  status: ExposureStatus;
  /** ISO-8601 timestamp when the exposure was created. */
  createdAt: string;
  /** ISO-8601 timestamp when the exposure will expire. */
  expiresAt: string;
  /** ISO-8601 timestamp when the exposure was revoked, if applicable. */
  revokedAt?: string;
  /** ISO-8601 timestamp when the parent sandbox stopped, if applicable. */
  sandboxStoppedAt?: string;
  /** ISO-8601 timestamp of the last proxied request. */
  lastAccessedAt?: string;
  /** Default path appended to the URL when opened in a browser. */
  openPath?: string;
  /** Whether the original `Host` header is preserved when proxying. */
  preserveHost: boolean;
  /** Identifier of the user or API key that created the exposure. */
  createdBy?: string;
}

export interface CreateExposureOptions {
  visibility?: ExposureVisibility;
  ttlSeconds?: number;
  slug?: string;
  openPath?: string;
  preserveHost?: boolean;
}

export interface RefreshExposureOptions {
  ttlSeconds?: number;
}

export interface RunCommandOptions {
  cwd?: string;
  timeout?: number;
  background?: boolean;
  envs?: Record<string, string>;
  user?: string;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export interface CreateSandboxOptions {
  /** Sandbox timeout in seconds. Default varies by template (typically 300). Use `0` for a permanent sandbox. */
  timeout?: number;
  /** OmniRun API key. Falls back to `OMNIRUN_API_KEY` environment variable. */
  apiKey?: string;
  /** OmniRun API base URL. Falls back to `OMNIRUN_API_URL` environment variable. */
  apiUrl?: string;
  /** HTTP request timeout in milliseconds for SDK-to-API calls. */
  requestTimeout?: number;
  /** Enable outbound internet access from the sandbox. Default: `false`. */
  internet?: boolean;
  /** Memory allocation in MB. Overrides the template default when set. */
  memory?: number;
  /** Environment variables injected into the sandbox at creation time. */
  envVars?: Record<string, string>;
  /** Arbitrary key-value metadata attached to the sandbox. Queryable via `list()`. */
  metadata?: Record<string, string>;
  /** Heartbeat interval in seconds. The SDK sends periodic `setTimeout` calls to prevent auto-kill. */
  keepAlive?: number;
  /** Auto-pause the sandbox after a period of inactivity instead of killing it. */
  autoPause?: boolean;
  /** Network policy controlling allowed/denied domains and IPs for outbound traffic. */
  network?: NetworkPolicy;
  /** Enable E2E encrypted mode for the sandbox. */
  secure?: boolean;
  /** Mask the request `Host` header seen inside the sandbox with this value. */
  maskRequestHost?: string;
  /** Inject vault credentials into the sandbox as environment variables via `/tmp/.omnirun-env`. */
  vaultInject?: boolean;
  /** Client-side E2EE bootstrap options (key generation + public key announcement). Pass `true` for defaults. */
  e2ee?: boolean | E2EECreateOptions;
}

export interface ListSandboxOptions {
  apiKey?: string;
  apiUrl?: string;
  limit?: number;
  nextToken?: string;
  state?: string;
  metadata?: Record<string, string>;
}

// Interpreter context types

export interface ContextInfo {
  id: string;
  language: string;
  createdAt: string;
  cwd?: string;
}

export interface ResultItem {
  text?: string;
  png?: string;
  html?: string;
  svg?: string;
  markdown?: string;
  json?: any;
  latex?: string;
  javascript?: string;
}

export interface LogOutput {
  stdout: string;
  stderr: string;
}

export interface ExecutionResult {
  results: ResultItem[];
  logs: LogOutput;
  error?: string;
  executionCount?: number;
}

// Production types

/** Aggregated usage metrics for a sandbox. */
export interface SandboxMetrics {
  /** Total CPU time consumed in milliseconds. */
  cpuTimeMs: number;
  /** Current memory usage in megabytes. */
  memoryUsedMb: number;
  /** Current disk usage in megabytes. */
  diskUsedMb: number;
  /** Network bytes received in kilobytes. */
  networkRxKb: number;
  /** Network bytes transmitted in kilobytes. */
  networkTxKb: number;
  /** Number of commands executed in the sandbox. */
  commandCount: number;
  /** Human-readable uptime string or ISO-8601 timestamp. */
  uptime: string;
}

/** Network policy controlling outbound traffic from a sandbox. */
export interface NetworkPolicy {
  /** Domains the sandbox is allowed to reach. If set, only these domains are permitted. */
  allowDomains?: string[];
  /** Domains the sandbox is explicitly blocked from reaching. */
  denyDomains?: string[];
  /** IP addresses or CIDR ranges the sandbox is allowed to reach. */
  allowIPs?: string[];
  /** IP addresses or CIDR ranges the sandbox is explicitly blocked from reaching. */
  denyIPs?: string[];
}

// Webhook types

export interface WebhookInfo {
  id: string;
  url: string;
  events: string[];
}

export interface CodeResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** A single point-in-time metrics snapshot from the sandbox time-series. */
export interface MetricsSnapshot {
  /** ISO-8601 timestamp of the snapshot. */
  timestamp: string;
  /** CPU utilization as a percentage (0-100). */
  cpuUsedPct: number;
  /** Number of virtual CPUs allocated to the sandbox. */
  cpuCount: number;
  /** Memory currently used in bytes. */
  memUsed: number;
  /** Total memory available in bytes. */
  memTotal: number;
  /** Disk space currently used in bytes. */
  diskUsed: number;
  /** Total disk space available in bytes. */
  diskTotal: number;
}

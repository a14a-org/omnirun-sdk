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
  timeout?: number;
  apiKey?: string;
  apiUrl?: string;
  requestTimeout?: number;
  internet?: boolean;
  envVars?: Record<string, string>;
  metadata?: Record<string, string>;
  keepAlive?: number;
  autoPause?: boolean;
  network?: NetworkPolicy;
  secure?: boolean;
  maskRequestHost?: string;
  /** Client-side E2EE bootstrap options (key generation + public key announcement). */
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

export interface SandboxMetrics {
  cpuTimeMs: number;
  memoryUsedMb: number;
  diskUsedMb: number;
  networkRxKb: number;
  networkTxKb: number;
  commandCount: number;
  uptime: string;
}

export interface NetworkPolicy {
  allowDomains?: string[];
  denyDomains?: string[];
  allowIPs?: string[];
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

export interface MetricsSnapshot {
  timestamp: string;
  cpuUsedPct: number;
  cpuCount: number;
  memUsed: number;
  memTotal: number;
  diskUsed: number;
  diskTotal: number;
}

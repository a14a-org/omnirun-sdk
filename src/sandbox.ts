import { HTTPClient } from "./client.js";
import { Commands } from "./commands.js";
import { resolveConfig } from "./config.js";
import { Contexts } from "./contexts.js";
import {
  generateE2EEKeyPair,
  type E2EECreateOptions,
  type E2EEKeyPairMaterial,
  type E2EESessionInfo,
} from "./e2ee.js";
import { Filesystem } from "./filesystem.js";
import type {
  CodeResult,
  CreateSandboxOptions,
  FullSandboxInfo,
  ListSandboxOptions,
  MetricsSnapshot,
  NetworkPolicy,
  SandboxInfo,
} from "./models.js";
import { Production } from "./production.js";
import { Pty } from "./pty.js";
import { makeCommandResult } from "./utils.js";
import { Webhooks } from "./webhooks.js";

function encodeMetadataFilter(metadata?: Record<string, string>): string | undefined {
  if (!metadata) return undefined;
  const entries = Object.entries(metadata);
  if (entries.length === 0) return undefined;
  const [key, value] = entries[0];
  return `${key}:${value}`;
}

function parseSandboxInfo(s: any): SandboxInfo {
  return {
    sandboxId: s.sandboxID,
    templateId: s.templateID ?? s.templateId ?? "",
    status: s.state ?? "running",
    startedAt: s.startedAt ?? "",
    endAt: s.endAt,
    name: s.name ?? s.metadata?.name,
    state: s.state,
    cpuCount: s.cpuCount,
    memoryMB: s.memoryMB,
  };
}

function parseFullSandboxInfo(s: any): FullSandboxInfo {
  const base = parseSandboxInfo(s);
  return {
    ...base,
    templateId: base.templateId || s.templateID || s.templateId || "",
    state: s.state ?? base.state ?? "unknown",
    cpuCount: s.cpuCount ?? base.cpuCount ?? 0,
    memoryMB: s.memoryMB ?? base.memoryMB ?? 0,
  };
}

function normalizeE2EEOptions(
  e2ee: CreateSandboxOptions["e2ee"]
): E2EECreateOptions | null {
  if (!e2ee) return null;
  if (e2ee === true) return { enabled: true };
  if (typeof e2ee === "object" && (e2ee.enabled ?? true)) {
    return { enabled: true, keyPair: e2ee.keyPair, clientPublicKey: e2ee.clientPublicKey };
  }
  return null;
}

/** Cursor paginator for listing sandboxes via `x-next-token`. */
export class SandboxPaginator {
  private client: HTTPClient;
  private limit: number;
  private state?: string;
  private metadata?: Record<string, string>;
  private nextToken: string | null = null;
  private _hasNext = true;
  private firstCall = true;

  constructor(opts?: ListSandboxOptions & { limit?: number }) {
    const config = resolveConfig(opts);
    this.client = new HTTPClient(config);
    this.limit = opts?.limit ?? 50;
    this.state = opts?.state;
    this.metadata = opts?.metadata;
  }

  get hasNext(): boolean {
    return this._hasNext;
  }

  async nextItems(): Promise<SandboxInfo[]> {
    if (!this._hasNext && !this.firstCall) return [];

    this.firstCall = false;
    const params: Record<string, string> = { limit: String(this.limit) };
    if (this.nextToken) params.next_token = this.nextToken;
    if (this.state) params.state = this.state;
    const metadataFilter = encodeMetadataFilter(this.metadata);
    if (metadataFilter) params.metadata = metadataFilter;

    const { data, headers } = await this.client.getWithHeaders<any[]>(
      "/sandboxes",
      params
    );
    const sandboxes = Array.isArray(data) ? data : [];

    const token = headers.get("x-next-token") || "";
    this.nextToken = token || null;
    this._hasNext = !!this.nextToken;

    return sandboxes.map(parseSandboxInfo);
  }
}

/** Top-level sandbox abstraction covering lifecycle and nested API namespaces. */
export class Sandbox {
  readonly sandboxId: string;
  readonly commands: Commands;
  readonly files: Filesystem;
  readonly pty: Pty;
  readonly contexts: Contexts;
  readonly production: Production;
  readonly webhooks: Webhooks;
  e2ee: E2EESessionInfo | null = null;
  trafficAccessToken: string = "";
  private client: HTTPClient;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  private constructor(sandboxId: string, client: HTTPClient) {
    this.sandboxId = sandboxId;
    this.client = client;
    this.commands = new Commands(sandboxId, client);
    this.files = new Filesystem(sandboxId, client);
    this.pty = new Pty(sandboxId, client);
    this.contexts = new Contexts(sandboxId, client);
    this.production = new Production(sandboxId, client);
    this.webhooks = new Webhooks(client);
  }

  static async create(
    template = "python-3.11",
    opts?: CreateSandboxOptions
  ): Promise<Sandbox> {
    const config = resolveConfig({
      apiUrl: opts?.apiUrl,
      apiKey: opts?.apiKey,
      requestTimeout: opts?.requestTimeout,
    });
    const client = new HTTPClient(config);

    const body: Record<string, any> = {
      template,
      timeout: opts?.timeout ?? 300,
    };
    const e2eeOpts = normalizeE2EEOptions(opts?.e2ee);
    let e2eeKeyPair: E2EEKeyPairMaterial | undefined;
    let clientPublicKey: string | undefined;

    if (e2eeOpts?.enabled) {
      e2eeKeyPair = e2eeOpts.keyPair ?? (await generateE2EEKeyPair());
      clientPublicKey = e2eeOpts.clientPublicKey ?? e2eeKeyPair.publicKeyBase64;
      body.e2ee = true;
      body.clientPublicKey = clientPublicKey;
    }
    if (opts?.internet) body.internet = true;
    if (opts?.envVars) body.envVars = opts.envVars;
    if (opts?.metadata) body.metadata = opts.metadata;
    if (opts?.autoPause) body.autoPause = true;
    if (opts?.network) body.network = opts.network;
    if (opts?.secure) body.secure = true;
    if (opts?.maskRequestHost) body.maskRequestHost = opts.maskRequestHost;

    const data = await client.post<{
      sandboxID: string;
      trafficToken?: string;
      serverPublicKey?: string;
      e2ee?: { serverPublicKey?: string };
    }>("/sandboxes", body);
    const sandbox = new Sandbox(data.sandboxID, client);
    sandbox.trafficAccessToken = data.trafficToken ?? "";
    if (e2eeOpts?.enabled && clientPublicKey) {
      sandbox.e2ee = {
        enabled: true,
        clientPublicKey,
        clientKeyPair: e2eeKeyPair,
        serverPublicKey: data.serverPublicKey ?? data.e2ee?.serverPublicKey,
      };
    }

    if (opts?.keepAlive != null) {
      const interval = opts.keepAlive;
      const timeout = opts.timeout ?? 300;
      sandbox.keepAliveInterval = setInterval(async () => {
        try {
          await sandbox.setTimeout(timeout);
        } catch {
          // ignore errors during heartbeat
        }
      }, interval * 1000);
    }

    return sandbox;
  }

  static async connect(
    sandboxId: string,
    opts?: { apiKey?: string; apiUrl?: string; requestTimeout?: number }
  ): Promise<Sandbox> {
    const config = resolveConfig(opts);
    const client = new HTTPClient(config);
    await client.get(`/sandboxes/${sandboxId}`);
    return new Sandbox(sandboxId, client);
  }

  static async list(opts?: ListSandboxOptions): Promise<SandboxInfo[]> {
    const config = resolveConfig(opts);
    const client = new HTTPClient(config);

    const params: Record<string, string> = {};
    if (opts?.limit != null) params.limit = String(opts.limit);
    if (opts?.nextToken) params.next_token = opts.nextToken;
    if (opts?.state) params.state = opts.state;
    const metadataFilter = encodeMetadataFilter(opts?.metadata);
    if (metadataFilter) params.metadata = metadataFilter;

    const data = await client.get<any[]>(
      "/sandboxes",
      Object.keys(params).length > 0 ? params : undefined
    );
    const sandboxes = Array.isArray(data) ? data : [];
    return sandboxes.map(parseSandboxInfo);
  }

  static paginate(opts?: ListSandboxOptions): SandboxPaginator {
    return new SandboxPaginator(opts);
  }

  async kill(): Promise<void> {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    await this.client.delete(`/sandboxes/${this.sandboxId}`);
  }

  async setTimeout(timeout: number): Promise<void> {
    await this.client.post(`/sandboxes/${this.sandboxId}/timeout`, { timeout });
  }

  async isRunning(): Promise<boolean> {
    try {
      const data = await this.client.get<{ state: string }>(
        `/sandboxes/${this.sandboxId}`
      );
      return data.state === "running";
    } catch {
      return false;
    }
  }

  async getInfo(): Promise<FullSandboxInfo> {
    const data = await this.client.get<any>(`/sandboxes/${this.sandboxId}`);
    return parseFullSandboxInfo(data);
  }

  /** Execute code via the /code endpoint. */
  async runCode(code: string, language = "python"): Promise<CodeResult> {
    const data = await this.client.post<any>(
      `/sandboxes/${this.sandboxId}/code`,
      { code, language }
    );
    return makeCommandResult(data);
  }

  /** Get public URL for a port exposed inside the sandbox. */
  getHost(port: number): string {
    return `https://${this.sandboxId}-${port}.claudebox.io`;
  }

  /** Get a pre-signed download URL for a file. */
  async downloadUrl(path: string): Promise<string> {
    const data = await this.client.post<{ url: string }>(
      `/sandboxes/${this.sandboxId}/files/download-url`,
      { path }
    );
    let url = data.url ?? "";
    if (url && !url.startsWith("http")) {
      url = this.client.baseUrl.replace(/\/$/, "") + url;
    }
    return url;
  }

  /** Get a pre-signed upload URL for a file. */
  async uploadUrl(path: string): Promise<string> {
    const data = await this.client.post<{ url: string }>(
      `/sandboxes/${this.sandboxId}/files/upload-url`,
      { path }
    );
    let url = data.url ?? "";
    if (url && !url.startsWith("http")) {
      url = this.client.baseUrl.replace(/\/$/, "") + url;
    }
    return url;
  }

  // Convenience wrappers delegating to production namespace (e2b compat)

  async pause(): Promise<{ status: string }> {
    return this.production.pause();
  }

  async resume(): Promise<{ status: string }> {
    return this.production.resume();
  }

  async getMetrics(): Promise<MetricsSnapshot[]> {
    const data = await this.client.get<any>(`/sandboxes/${this.sandboxId}/metrics`);
    if (Array.isArray(data)) {
      return data.map((m: any) => ({
        timestamp: m.timestamp ?? "",
        cpuUsedPct: m.cpu_used_pct ?? 0,
        cpuCount: m.cpu_count ?? 0,
        memUsed: m.mem_used ?? 0,
        memTotal: m.mem_total ?? 0,
        diskUsed: m.disk_used ?? 0,
        diskTotal: m.disk_total ?? 0,
      }));
    }
    return [];
  }

  async setNetworkPolicy(policy: NetworkPolicy): Promise<void> {
    return this.production.setNetworkPolicy(policy);
  }
}

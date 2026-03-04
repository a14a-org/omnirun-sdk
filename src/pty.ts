import type { HTTPClient } from "./client.js";
import type { PtyInfo } from "./models.js";

/** PTY namespace for terminal sessions in a sandbox. */
export class Pty {
  private sandboxId: string;
  private client: HTTPClient;

  constructor(sandboxId: string, client: HTTPClient) {
    this.sandboxId = sandboxId;
    this.client = client;
  }

  private get baseUrl(): string {
    return `/sandboxes/${this.sandboxId}/pty`;
  }

  async create(opts?: { cols?: number; rows?: number }): Promise<PtySession> {
    const data = await this.client.post<{ pid: number }>(this.baseUrl, {
      cols: opts?.cols ?? 80,
      rows: opts?.rows ?? 24,
    });
    return new PtySession(data.pid, this.sandboxId, this.client);
  }

  async list(): Promise<PtyInfo[]> {
    return this.client.get<PtyInfo[]>(this.baseUrl);
  }
}

/** Handle for a single PTY session. */
export class PtySession {
  readonly pid: number;
  private sandboxId: string;
  private client: HTTPClient;

  constructor(pid: number, sandboxId: string, client: HTTPClient) {
    this.pid = pid;
    this.sandboxId = sandboxId;
    this.client = client;
  }

  private get url(): string {
    return `/sandboxes/${this.sandboxId}/pty/${this.pid}`;
  }

  async sendStdin(data: string): Promise<void> {
    await this.client.post(`${this.url}/input`, { data });
  }

  async resize(cols: number, rows: number): Promise<void> {
    await this.client.post(`${this.url}/resize`, { cols, rows });
  }

  async read(): Promise<string> {
    const data = await this.client.get<{ data: string }>(`${this.url}/read`);
    return data.data ?? "";
  }

  async kill(): Promise<void> {
    await this.client.delete(this.url);
  }
}

import type { ConnectionConfig } from "./config.js";
import { SandboxError, StreamError } from "./errors.js";
import type { StreamEvent } from "./models.js";

/** Low-level HTTP transport for OmniRun API requests. */
export class HTTPClient {
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  get baseUrl(): string {
    return this.config.apiUrl;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKey) {
      h["X-API-Key"] = this.config.apiKey;
    }
    return h;
  }

  async get<T = any>(path: string, params?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, params);
    const resp = await fetch(url, {
      method: "GET",
      headers: this.headers,
      signal: AbortSignal.timeout(this.config.requestTimeout),
    });
    return this.handle<T>(resp);
  }

  async post<T = any>(path: string, body?: any): Promise<T> {
    const resp = await fetch(this.buildUrl(path), {
      method: "POST",
      headers: this.headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.config.requestTimeout),
    });
    return this.handle<T>(resp);
  }

  async delete(path: string, params?: Record<string, string>): Promise<void> {
    const url = this.buildUrl(path, params);
    const resp = await fetch(url, {
      method: "DELETE",
      headers: this.headers,
      signal: AbortSignal.timeout(this.config.requestTimeout),
    });
    if (resp.status === 204) return;
    if (!resp.ok) {
      const text = await resp.text();
      throw new SandboxError(`API error ${resp.status}: ${text}`);
    }
  }

  async download(path: string, params?: Record<string, string>): Promise<Uint8Array> {
    const url = this.buildUrl(path, params);
    const resp = await fetch(url, {
      method: "GET",
      headers: { "X-API-Key": this.config.apiKey || "" },
      signal: AbortSignal.timeout(this.config.requestTimeout),
    });
    if (!resp.ok) {
      throw new SandboxError(`Download error ${resp.status}: ${await resp.text()}`);
    }
    return new Uint8Array(await resp.arrayBuffer());
  }

  async streamDownload(path: string, params?: Record<string, string>): Promise<ReadableStream<Uint8Array>> {
    const url = this.buildUrl(path, params);
    const resp = await fetch(url, {
      method: "GET",
      headers: { "X-API-Key": this.config.apiKey || "" },
    });
    if (!resp.ok) {
      throw new SandboxError(`Download error ${resp.status}: ${await resp.text()}`);
    }
    if (!resp.body) {
      throw new SandboxError("No response body for stream download");
    }
    return resp.body;
  }

  async getWithHeaders<T = any>(path: string, params?: Record<string, string>): Promise<{ data: T; headers: Headers }> {
    const url = this.buildUrl(path, params);
    const resp = await fetch(url, {
      method: "GET",
      headers: this.headers,
      signal: AbortSignal.timeout(this.config.requestTimeout),
    });
    const data = await this.handle<T>(resp);
    return { data, headers: resp.headers };
  }

  async upload(path: string, filePath: string, content: Uint8Array, filename: string): Promise<any> {
    const form = new FormData();
    form.append("path", filePath);
    form.append("file", new Blob([content as BlobPart]), filename);

    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers["X-API-Key"] = this.config.apiKey;
    }

    const resp = await fetch(this.buildUrl(path), {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(this.config.requestTimeout),
    });
    return this.handle(resp);
  }

  async *streamSSE(path: string, params?: Record<string, string>): AsyncGenerator<StreamEvent> {
    const url = this.buildUrl(path, params);
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        ...this.headers,
        Accept: "text/event-stream",
      },
    });

    yield* this.parseSSE(resp);
  }

  async *streamSSEPost(
    path: string,
    body?: unknown,
    signal?: AbortSignal
  ): AsyncGenerator<StreamEvent> {
    const resp = await fetch(this.buildUrl(path), {
      method: "POST",
      headers: {
        ...this.headers,
        Accept: "text/event-stream",
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal,
    });

    yield* this.parseSSE(resp);
  }

  async *streamSSEWithSignal(
    path: string,
    params?: Record<string, string>,
    signal?: AbortSignal
  ): AsyncGenerator<StreamEvent> {
    const url = this.buildUrl(path, params);
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        ...this.headers,
        Accept: "text/event-stream",
      },
      signal,
    });

    yield* this.parseSSE(resp);
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.config.apiUrl);
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        url.searchParams.set(key, val);
      }
    }
    return url.toString();
  }

  private async handle<T>(resp: Response): Promise<T> {
    if (!resp.ok) {
      const msg = await this.errorMessage(resp);
      throw new SandboxError(`API error ${resp.status}: ${msg}`);
    }

    if (resp.status === 204) {
      return undefined as T;
    }

    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return resp.json() as Promise<T>;
    }

    return (await resp.text()) as T;
  }

  private async *parseSSE(resp: Response): AsyncGenerator<StreamEvent> {
    if (!resp.ok) {
      throw new StreamError(`Stream error ${resp.status}: ${await this.errorMessage(resp)}`);
    }

    const reader = resp.body?.getReader();
    if (!reader) throw new StreamError("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              yield JSON.parse(line.slice(6)) as StreamEvent;
            } catch {
              // Skip malformed events
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async errorMessage(resp: Response): Promise<string> {
    const raw = await resp.text();
    if (!raw) return "request failed";

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        if (typeof obj.message === "string") return obj.message;
        if (typeof obj.error === "string") return obj.error;
      }
      return raw;
    } catch {
      return raw;
    }
  }
}

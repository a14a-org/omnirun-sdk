import type { HTTPClient } from "./client.js";
import type { EntryInfo, WriteEntry } from "./models.js";
import { WatchHandle } from "./watch-handle.js";

export interface FileReadOptions {
  user?: string;
}

export interface FileWriteOptions {
  user?: string;
}

export interface FileListOptions {
  depth?: number;
  user?: string;
}

/** File operations namespace for a single sandbox. */
export class Filesystem {
  private sandboxId: string;
  private client: HTTPClient;

  constructor(sandboxId: string, client: HTTPClient) {
    this.sandboxId = sandboxId;
    this.client = client;
  }

  private get baseUrl(): string {
    return `/sandboxes/${this.sandboxId}/files`;
  }

  async read(path: string, format?: "text", opts?: FileReadOptions): Promise<string>;
  async read(path: string, format: "bytes", opts?: FileReadOptions): Promise<Uint8Array>;
  async read(path: string, format: "stream", opts?: FileReadOptions): Promise<ReadableStream<Uint8Array>>;
  async read(
    path: string,
    format: "text" | "bytes" | "stream" = "text",
    opts?: FileReadOptions
  ): Promise<string | Uint8Array | ReadableStream<Uint8Array>> {
    const params: Record<string, string> = { path };
    if (opts?.user) params.user = opts.user;

    if (format === "stream") {
      return this.client.streamDownload(`${this.baseUrl}/download`, params);
    }
    if (format === "bytes") {
      return this.client.download(`${this.baseUrl}/download`, params);
    }
    const data = await this.client.get<{ content: string }>(this.baseUrl, params);
    return data.content ?? "";
  }

  async write(path: string, content: string, opts?: FileWriteOptions): Promise<EntryInfo>;
  async write(path: string, content: Uint8Array, opts?: FileWriteOptions): Promise<EntryInfo>;
  async write(entries: WriteEntry[]): Promise<EntryInfo[]>;
  async write(
    pathOrEntries: string | WriteEntry[],
    content?: string | Uint8Array | FileWriteOptions,
    opts?: FileWriteOptions
  ): Promise<EntryInfo | EntryInfo[]> {
    // Batch write
    if (Array.isArray(pathOrEntries)) {
      const data = await this.client.post<any[]>(`${this.baseUrl}/batch`, pathOrEntries);
      return data.map((r) => ({
        name: r.name ?? "",
        path: r.path ?? "",
        isDir: r.is_dir ?? false,
        size: r.size ?? 0,
      }));
    }

    const path = pathOrEntries;
    const writeOpts = opts;

    // Binary upload
    if (content instanceof Uint8Array) {
      const filename = path.split("/").pop() || "upload";
      const data = await this.client.upload(`${this.baseUrl}/upload`, path, content, filename);
      return {
        name: data.name ?? filename,
        path: data.path ?? path,
        isDir: false,
        size: data.size ?? content.length,
      };
    }

    // Text write
    const body: Record<string, any> = { path, content: content ?? "" };
    if (writeOpts?.user) body.user = writeOpts.user;
    const data = await this.client.post<any>(this.baseUrl, body);
    return {
      name: path.split("/").pop() || "",
      path: data.path ?? path,
      isDir: false,
      size: (typeof content === "string" ? content : "").length,
    };
  }

  async list(path = "/", opts?: FileListOptions): Promise<EntryInfo[]> {
    const params: Record<string, string> = { path };
    if (opts?.depth != null && opts.depth !== 1) {
      params.depth = String(opts.depth);
    }
    if (opts?.user) params.user = opts.user;
    const data = await this.client.get<any[]>(`${this.baseUrl}/list`, params);
    const entries = Array.isArray(data) ? data : [];
    return entries.map((e) => ({
      name: e.name,
      path: e.path,
      isDir: e.is_dir,
      size: e.size ?? 0,
    }));
  }

  async exists(path: string, opts?: FileReadOptions): Promise<boolean> {
    const params: Record<string, string> = { path };
    if (opts?.user) params.user = opts.user;
    const data = await this.client.get<{ exists: boolean }>(`${this.baseUrl}/exists`, params);
    return data.exists ?? false;
  }

  async info(path: string, opts?: FileReadOptions): Promise<EntryInfo> {
    const params: Record<string, string> = { path };
    if (opts?.user) params.user = opts.user;
    const data = await this.client.get<any>(`${this.baseUrl}/info`, params);
    return {
      name: data.name ?? "",
      path: data.path ?? path,
      isDir: data.is_dir ?? false,
      size: data.size ?? 0,
    };
  }

  async remove(path: string, opts?: FileWriteOptions): Promise<void> {
    const params: Record<string, string> = { path };
    if (opts?.user) params.user = opts.user;
    await this.client.delete(this.baseUrl, params);
  }

  async rename(oldPath: string, newPath: string, opts?: FileWriteOptions): Promise<EntryInfo> {
    const body: Record<string, any> = { oldPath, newPath };
    if (opts?.user) body.user = opts.user;
    const data = await this.client.post<any>(`${this.baseUrl}/rename`, body);
    return {
      name: data.name ?? "",
      path: data.path ?? newPath,
      isDir: data.is_dir ?? false,
      size: data.size ?? 0,
    };
  }

  async makeDir(path: string, opts?: FileWriteOptions): Promise<void> {
    const body: Record<string, any> = { path };
    if (opts?.user) body.user = opts.user;
    await this.client.post(`${this.baseUrl}/mkdir`, body);
  }

  watchDir(path: string, opts?: { recursive?: boolean }): WatchHandle {
    return new WatchHandle(this.sandboxId, path, opts?.recursive ?? false, this.client);
  }
}

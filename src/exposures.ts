import type { HTTPClient } from "./client.js";
import type {
  CreateExposureOptions,
  ExposureInfo,
  RefreshExposureOptions,
} from "./models.js";

function parseExposureInfo(data: any): ExposureInfo {
  return {
    id: data.id ?? "",
    sandboxId: data.sandboxId ?? data.sandboxID ?? "",
    accountId: data.accountId,
    port: data.port ?? 0,
    hostname: data.hostname ?? "",
    url: data.url ?? "",
    accessUrl: data.accessUrl,
    visibility: data.visibility ?? "public",
    status: data.status ?? "pending",
    createdAt: data.createdAt ?? "",
    expiresAt: data.expiresAt ?? "",
    revokedAt: data.revokedAt,
    sandboxStoppedAt: data.sandboxStoppedAt,
    lastAccessedAt: data.lastAccessedAt,
    openPath: data.openPath ?? "/",
    preserveHost: data.preserveHost ?? true,
    createdBy: data.createdBy,
  };
}

/** Preview URL management namespace for a sandbox. */
export class Exposures {
  private sandboxId: string;
  private client: HTTPClient;

  constructor(sandboxId: string, client: HTTPClient) {
    this.sandboxId = sandboxId;
    this.client = client;
  }

  private get baseUrl(): string {
    return `/sandboxes/${this.sandboxId}/exposures`;
  }

  async create(port: number, opts?: CreateExposureOptions): Promise<ExposureInfo> {
    const data = await this.client.post<any>(this.baseUrl, {
      port,
      visibility: opts?.visibility,
      requestedTtlSeconds: opts?.ttlSeconds,
      slug: opts?.slug,
      openPath: opts?.openPath,
      preserveHost: opts?.preserveHost,
    });
    return parseExposureInfo(data);
  }

  async list(): Promise<ExposureInfo[]> {
    const data = await this.client.get<any[]>(this.baseUrl);
    const items = Array.isArray(data) ? data : [];
    return items.map(parseExposureInfo);
  }

  async get(exposureId: string): Promise<ExposureInfo> {
    const data = await this.client.get<any>(`${this.baseUrl}/${exposureId}`);
    return parseExposureInfo(data);
  }

  async refresh(
    exposureId: string,
    opts?: RefreshExposureOptions
  ): Promise<ExposureInfo> {
    const data = await this.client.post<any>(`${this.baseUrl}/${exposureId}/refresh`, {
      requestedTtlSeconds: opts?.ttlSeconds,
    });
    return parseExposureInfo(data);
  }

  async close(exposureId: string): Promise<void> {
    await this.client.delete(`${this.baseUrl}/${exposureId}`);
  }
}

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

/**
 * Preview URL management namespace for a sandbox.
 *
 * An exposure creates a publicly (or privately) accessible URL that proxies
 * traffic to a port inside the sandbox. The lifecycle of an exposure is:
 *
 * `pending` -> `ready` -> `expired` | `revoked` | `sandbox_stopped`
 *
 * - **pending**: The exposure has been requested but the proxy is not yet routing traffic.
 * - **ready**: The URL is live and accepting requests.
 * - **expired**: The TTL elapsed without a refresh.
 * - **revoked**: The exposure was explicitly closed via {@link close}.
 * - **sandbox_stopped**: The parent sandbox was killed or stopped.
 */
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

  /**
   * Create a new exposure for a sandbox port.
   *
   * @param port - The port number inside the sandbox to expose (1-65535).
   * @param opts - Optional configuration.
   * @param opts.visibility - `"public"` (default) or `"private"` (requires auth token).
   * @param opts.ttlSeconds - Time-to-live in seconds before the exposure expires.
   * @param opts.slug - Custom slug for the exposure URL.
   * @param opts.openPath - Path appended to the exposure URL when opened in a browser.
   * @param opts.preserveHost - Whether to preserve the original `Host` header when proxying.
   * @returns The created {@link ExposureInfo}.
   */
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

  /**
   * List all exposures for this sandbox.
   *
   * @returns An array of {@link ExposureInfo} objects for every exposure
   *   (including expired and revoked ones).
   */
  async list(): Promise<ExposureInfo[]> {
    const data = await this.client.get<any[]>(this.baseUrl);
    const items = Array.isArray(data) ? data : [];
    return items.map(parseExposureInfo);
  }

  /**
   * Get details for a single exposure.
   *
   * @param exposureId - The unique exposure identifier.
   * @returns The {@link ExposureInfo} for the requested exposure.
   */
  async get(exposureId: string): Promise<ExposureInfo> {
    const data = await this.client.get<any>(`${this.baseUrl}/${exposureId}`);
    return parseExposureInfo(data);
  }

  /**
   * Extend the TTL of an existing exposure, preventing it from expiring.
   *
   * @param exposureId - The unique exposure identifier.
   * @param opts - Optional refresh options.
   * @param opts.ttlSeconds - New TTL in seconds from now. If omitted the server default is used.
   * @returns The updated {@link ExposureInfo} with the new `expiresAt` timestamp.
   */
  async refresh(
    exposureId: string,
    opts?: RefreshExposureOptions
  ): Promise<ExposureInfo> {
    const data = await this.client.post<any>(`${this.baseUrl}/${exposureId}/refresh`, {
      requestedTtlSeconds: opts?.ttlSeconds,
    });
    return parseExposureInfo(data);
  }

  /**
   * Permanently close and revoke an exposure. The URL will immediately
   * stop accepting traffic. This action cannot be undone.
   *
   * @param exposureId - The unique exposure identifier.
   */
  async close(exposureId: string): Promise<void> {
    await this.client.delete(`${this.baseUrl}/${exposureId}`);
  }
}

import type { HTTPClient } from "./client.js";
import type { MetricsSnapshot, NetworkPolicy, SandboxMetrics } from "./models.js";

/** Map a raw metrics snapshot from the API (snake_case) to a {@link MetricsSnapshot}. */
export function parseMetricsSnapshot(m: any): MetricsSnapshot {
  return {
    timestamp: m.timestamp ?? "",
    cpuUsedPct: m.cpu_used_pct ?? 0,
    cpuCount: m.cpu_count ?? 0,
    memUsed: m.mem_used ?? 0,
    memTotal: m.mem_total ?? 0,
    diskUsed: m.disk_used ?? 0,
    diskTotal: m.disk_total ?? 0,
  };
}

/** Production controls for pause/resume/metrics/network policy. */
export class Production {
  private sandboxId: string;
  private client: HTTPClient;

  constructor(sandboxId: string, client: HTTPClient) {
    this.sandboxId = sandboxId;
    this.client = client;
  }

  private get baseUrl(): string {
    return `/sandboxes/${this.sandboxId}`;
  }

  /** Pause the sandbox VM. */
  async pause(): Promise<{ status: string }> {
    return this.client.post<{ status: string }>(`${this.baseUrl}/pause`);
  }

  /** Resume a paused sandbox VM. */
  async resume(): Promise<{ status: string }> {
    return this.client.post<{ status: string }>(`${this.baseUrl}/resume`);
  }

  /** Get usage metrics for the sandbox. */
  async metrics(): Promise<SandboxMetrics> {
    const data = await this.client.get<any>(`${this.baseUrl}/metrics`);

    // Newer API shape: array of snapshots.
    if (Array.isArray(data)) {
      const last = data[data.length - 1] ?? {};
      return {
        cpuTimeMs: 0,
        memoryUsedMb: Math.round((last.mem_used ?? 0) / (1024 * 1024)),
        diskUsedMb: Math.round((last.disk_used ?? 0) / (1024 * 1024)),
        networkRxKb: 0,
        networkTxKb: 0,
        commandCount: 0,
        uptime: last.timestamp ?? "",
      };
    }

    return {
      cpuTimeMs: data.cpu_time_ms ?? 0,
      memoryUsedMb: data.memory_used_mb ?? 0,
      diskUsedMb: data.disk_used_mb ?? 0,
      networkRxKb: data.network_rx_kb ?? 0,
      networkTxKb: data.network_tx_kb ?? 0,
      commandCount: data.command_count ?? 0,
      uptime: String(data.uptime ?? ""),
    };
  }

  /** Get raw metrics snapshots if the backend returns time-series data. */
  async metricsSnapshots(): Promise<MetricsSnapshot[]> {
    const data = await this.client.get<any>(`${this.baseUrl}/metrics`);
    if (!Array.isArray(data)) return [];
    return data.map(parseMetricsSnapshot);
  }

  /** Set network policy for the sandbox. */
  async setNetworkPolicy(policy: NetworkPolicy): Promise<void> {
    await this.client.post(`${this.baseUrl}/network-policy`, {
      allowDomains: policy.allowDomains,
      denyDomains: policy.denyDomains,
      allowIPs: policy.allowIPs,
      denyIPs: policy.denyIPs,
    });
  }
}

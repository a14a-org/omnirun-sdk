import type { HTTPClient } from "./client.js";
import type { WebhookInfo } from "./models.js";

/** Webhook management namespace for sandbox lifecycle events. */
export class Webhooks {
  private client: HTTPClient;

  constructor(client: HTTPClient) {
    this.client = client;
  }

  /** Register a new lifecycle webhook. */
  async register(url: string, events: string[]): Promise<{ id: string }> {
    return this.client.post<{ id: string }>("/webhooks", { url, events });
  }

  /** List all registered webhooks. */
  async list(): Promise<WebhookInfo[]> {
    const data = await this.client.get<any[]>("/webhooks");
    const webhooks = Array.isArray(data) ? data : [];
    return webhooks.map((w) => ({
      id: w.id ?? "",
      url: w.url ?? "",
      events: Array.isArray(w.events) ? w.events : [],
    }));
  }

  /** Delete a webhook by ID. */
  async delete(webhookId: string): Promise<void> {
    await this.client.delete(`/webhooks/${webhookId}`);
  }
}

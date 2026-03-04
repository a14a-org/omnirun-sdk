import type { HTTPClient } from "./client.js";
import type { FilesystemEvent } from "./models.js";

/** Pull-based file watch stream handle backed by server-sent events. */
export class WatchHandle {
  private sandboxId: string;
  private path: string;
  private recursive: boolean;
  private client: HTTPClient;
  private events: FilesystemEvent[] = [];
  private abortController: AbortController;
  private running = true;

  constructor(
    sandboxId: string,
    path: string,
    recursive: boolean,
    client: HTTPClient
  ) {
    this.sandboxId = sandboxId;
    this.path = path;
    this.recursive = recursive;
    this.client = client;
    this.abortController = new AbortController();
    this.startPolling();
  }

  private async startPolling(): Promise<void> {
    const params: Record<string, string> = { path: this.path };
    if (this.recursive) params.recursive = "true";

    try {
      for await (const event of this.client.streamSSEWithSignal(
        `/sandboxes/${this.sandboxId}/files/watch`,
        params,
        this.abortController.signal
      )) {
        if (!this.running) break;
        const fsEvent = event as unknown as FilesystemEvent;
        if (fsEvent.type) {
          this.events.push(fsEvent);
        }
      }
    } catch {
      // Stream closed
    }
  }

  getNewEvents(): FilesystemEvent[] {
    const events = [...this.events];
    this.events = [];
    return events;
  }

  stop(): void {
    this.running = false;
    this.abortController.abort();
  }
}

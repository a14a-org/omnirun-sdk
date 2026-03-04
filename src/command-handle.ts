import type { HTTPClient } from "./client.js";
import { TimeoutError } from "./errors.js";
import type { CommandResult, ProcessInfo, StreamEvent } from "./models.js";
import { makeCommandResult } from "./utils.js";

/** Handle for a background command process. */
export class CommandHandle {
  readonly pid: number;
  private sandboxId: string;
  private client: HTTPClient;
  private _result: CommandResult | null = null;

  constructor(pid: number, sandboxId: string, client: HTTPClient) {
    this.pid = pid;
    this.sandboxId = sandboxId;
    this.client = client;
  }

  private get url(): string {
    return `/sandboxes/${this.sandboxId}/commands/${this.pid}`;
  }

  async wait(timeout = 60_000): Promise<CommandResult> {
    if (this._result) return this._result;

    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const info = await this.getInfo();
      if (!info.running) {
        this._result = makeCommandResult({
          stdout: info.stdout || "",
          stderr: info.stderr || "",
          exitCode: info.exitCode,
        });
        return this._result;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    throw new TimeoutError(`Process ${this.pid} did not finish within ${timeout}ms`);
  }

  async getInfo(): Promise<ProcessInfo> {
    const raw = await this.client.get<any>(this.url);
    return {
      pid: raw.pid,
      command: raw.command,
      running: raw.running,
      exitCode: raw.exit_code ?? raw.exitCode ?? 0,
      stdout: raw.stdout,
      stderr: raw.stderr,
      startedAt: raw.started_at ?? raw.startedAt,
      endedAt: raw.ended_at ?? raw.endedAt,
    };
  }

  async kill(): Promise<void> {
    await this.client.delete(this.url);
  }

  async stream(opts?: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
  }): Promise<CommandResult> {
    const stdoutParts: string[] = [];
    const stderrParts: string[] = [];
    let exitCode = 0;

    for await (const event of this.client.streamSSE(`${this.url}/stream`)) {
      if (event.type === "stdout" && event.data) {
        stdoutParts.push(event.data);
        opts?.onStdout?.(event.data);
      } else if (event.type === "stderr" && event.data) {
        stderrParts.push(event.data);
        opts?.onStderr?.(event.data);
      } else if (event.type === "exit") {
        exitCode = event.exit_code ?? 0;
        break;
      }
    }

    this._result = makeCommandResult({
      stdout: stdoutParts.join(""),
      stderr: stderrParts.join(""),
      exitCode,
    });
    return this._result;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<StreamEvent> {
    yield* this.client.streamSSE(`${this.url}/stream`);
  }
}

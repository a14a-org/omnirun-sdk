import type { HTTPClient } from "./client.js";
import { CommandHandle } from "./command-handle.js";
import { CommandExitException } from "./errors.js";
import type {
  CommandResult,
  ProcessInfo,
  RunCommandOptions,
} from "./models.js";
import { makeCommandResult } from "./utils.js";

/** Command execution namespace for a single sandbox. */
export class Commands {
  private sandboxId: string;
  private client: HTTPClient;

  constructor(sandboxId: string, client: HTTPClient) {
    this.sandboxId = sandboxId;
    this.client = client;
  }

  private get baseUrl(): string {
    return `/sandboxes/${this.sandboxId}/commands`;
  }

  async run(cmd: string, opts?: RunCommandOptions): Promise<CommandResult>;
  async run(
    cmd: string,
    opts: RunCommandOptions & { background: true }
  ): Promise<CommandHandle>;
  async run(
    cmd: string,
    opts?: RunCommandOptions
  ): Promise<CommandResult | CommandHandle> {
    const body: Record<string, any> = {
      command: cmd,
      timeout: opts?.timeout ?? 60,
    };
    if (opts?.cwd) body.cwd = opts.cwd;
    if (opts?.envs) body.envs = opts.envs;
    if (opts?.user) body.user = opts.user;

    if (opts?.background) {
      body.background = true;
      const data = await this.client.post<{ pid: number }>(this.baseUrl, body);
      return new CommandHandle(data.pid, this.sandboxId, this.client);
    }

    // Streaming via callbacks
    if (opts?.onStdout || opts?.onStderr) {
      body.background = true;
      const data = await this.client.post<{ pid: number }>(this.baseUrl, body);
      const handle = new CommandHandle(data.pid, this.sandboxId, this.client);
      const result = await handle.stream({
        onStdout: opts.onStdout,
        onStderr: opts.onStderr,
      });
      if (result.exitCode !== 0) {
        throw new CommandExitException(
          result.stdout,
          result.stderr,
          result.exitCode
        );
      }
      return result;
    }

    // Synchronous execution
    const data = await this.client.post<{
      stdout: string;
      stderr: string;
      exit_code: number;
    }>(this.baseUrl, body);
    const result = makeCommandResult(data);
    if (result.exitCode !== 0) {
      throw new CommandExitException(
        result.stdout,
        result.stderr,
        result.exitCode
      );
    }
    return result;
  }

  async list(): Promise<ProcessInfo[]> {
    return this.client.get<ProcessInfo[]>(this.baseUrl);
  }

  async get(pid: number): Promise<ProcessInfo> {
    return this.client.get<ProcessInfo>(`${this.baseUrl}/${pid}`);
  }

  async kill(pid: number): Promise<void> {
    await this.client.delete(`${this.baseUrl}/${pid}`);
  }

  async sendStdin(pid: number, data: string): Promise<void> {
    await this.client.post(`${this.baseUrl}/${pid}/stdin`, { data });
  }

  connect(pid: number): CommandHandle {
    return new CommandHandle(pid, this.sandboxId, this.client);
  }
}

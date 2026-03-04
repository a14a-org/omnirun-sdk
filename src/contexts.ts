import type { HTTPClient } from "./client.js";
import type { ContextInfo, ExecutionResult, ResultItem } from "./models.js";

export interface ExecuteOptions {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onResult?: (result: ResultItem) => void;
}

/** Persistent interpreter context namespace for a single sandbox. */
export class Contexts {
  private sandboxId: string;
  private client: HTTPClient;

  constructor(sandboxId: string, client: HTTPClient) {
    this.sandboxId = sandboxId;
    this.client = client;
  }

  private get baseUrl(): string {
    return `/sandboxes/${this.sandboxId}/contexts`;
  }

  /** Create a new interpreter context for the given language. */
  async create(language: string, opts?: { cwd?: string }): Promise<ContextInfo> {
    const body: Record<string, any> = { language };
    if (opts?.cwd) body.cwd = opts.cwd;
    const data = await this.client.post<any>(this.baseUrl, body);
    return {
      id: data.id ?? "",
      language: data.language ?? language,
      createdAt: data.created_at ?? "",
      cwd: data.cwd ?? "",
    };
  }

  /** List all interpreter contexts. */
  async list(): Promise<ContextInfo[]> {
    const data = await this.client.get<any[]>(this.baseUrl);
    const contexts = Array.isArray(data) ? data : [];
    return contexts.map((c) => ({
      id: c.id ?? "",
      language: c.language ?? "",
      createdAt: c.created_at ?? "",
      cwd: c.cwd ?? "",
    }));
  }

  /** Execute code in an existing interpreter context. */
  async execute(
    contextId: string,
    code: string,
    opts?: ExecuteOptions
  ): Promise<ExecutionResult> {
    if (opts?.onStdout || opts?.onStderr || opts?.onResult) {
      return this.streamExecute(contextId, code, opts);
    }
    const data = await this.client.post<any>(
      `${this.baseUrl}/${contextId}/execute`,
      { code }
    );
    return parseExecutionResult(data);
  }

  /** Delete an interpreter context. */
  async delete(contextId: string): Promise<void> {
    await this.client.delete(`${this.baseUrl}/${contextId}`);
  }

  /** Restart an interpreter context. */
  async restart(contextId: string): Promise<ContextInfo> {
    const data = await this.client.post<any>(
      `${this.baseUrl}/${contextId}/restart`
    );
    return {
      id: data.id ?? contextId,
      language: data.language ?? "",
      createdAt: data.created_at ?? "",
      cwd: data.cwd ?? "",
    };
  }

  private async streamExecute(
    contextId: string,
    code: string,
    opts?: ExecuteOptions
  ): Promise<ExecutionResult> {
    const stdoutParts: string[] = [];
    const stderrParts: string[] = [];
    const results: ResultItem[] = [];
    let executionCount = 0;

    for await (const event of this.client.streamSSEPost(
      `${this.baseUrl}/${contextId}/stream-execute`,
      { code }
    )) {
      const e = event as any;
      if (e.type === "stdout") {
        stdoutParts.push(e.data ?? "");
        opts?.onStdout?.(e.data ?? "");
      } else if (e.type === "stderr") {
        stderrParts.push(e.data ?? "");
        opts?.onStderr?.(e.data ?? "");
      } else if (e.type === "result") {
        const item = parseResultItem(e.data ?? {});
        results.push(item);
        opts?.onResult?.(item);
      } else if (e.type === "done") {
        executionCount = e.execution_count ?? 0;
      }
    }

    return {
      results,
      logs: { stdout: stdoutParts.join("\n"), stderr: stderrParts.join("\n") },
      executionCount,
    };
  }
}

function parseResultItem(r: any): ResultItem {
  return {
    text: r.text ?? undefined,
    png: r.png ?? undefined,
    html: r.html ?? undefined,
    svg: r.svg ?? undefined,
    markdown: r.markdown ?? undefined,
    json: r.json ?? undefined,
    latex: r.latex ?? undefined,
    javascript: r.javascript ?? undefined,
  };
}

function parseExecutionResult(data: any): ExecutionResult {
  return {
    results: Array.isArray(data.results)
      ? data.results.map(parseResultItem)
      : [],
    logs: {
      stdout: data.logs?.stdout ?? "",
      stderr: data.logs?.stderr ?? "",
    },
    error: data.error ?? undefined,
    executionCount: data.execution_count ?? 0,
  };
}

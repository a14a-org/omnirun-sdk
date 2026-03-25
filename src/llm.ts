import { resolveConfig, type ConnectionConfig } from "./config.js";
import { HTTPClient } from "./client.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatCompletionChoice {
  index: number;
  message: { role: string; content: string };
  finish_reason: string;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost?: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: ChatCompletionUsage;
}

export interface LLMUsage {
  spendUsedCents: number;
  spendCapCents: number;
  remainingCents: number;
}

export interface LLMModel {
  id: string;
  [key: string]: any;
}

export class LLM {
  private client: HTTPClient;

  constructor(config?: Partial<ConnectionConfig>) {
    this.client = new HTTPClient(resolveConfig(config));
  }

  /** Create a chat completion (non-streaming). */
  async chatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    return this.client.post<ChatCompletionResponse>(
      "/llm/v1/chat/completions",
      { ...request, stream: false },
    );
  }

  /** Stream a chat completion, yielding content delta strings. */
  async *streamChatCompletion(
    request: ChatCompletionRequest,
  ): AsyncGenerator<string> {
    const events = this.client.streamSSEPost("/llm/v1/chat/completions", {
      ...request,
      stream: true,
    });
    for await (const event of events) {
      // Each event is a parsed JSON object from the SSE stream.
      // The parseSSE helper silently drops non-JSON lines like [DONE].
      const chunk = event as any;
      const content = chunk?.choices?.[0]?.delta?.content;
      if (content) yield content;
    }
  }

  /** List available models. */
  async listModels(): Promise<LLMModel[]> {
    const resp = await this.client.get<{ data: LLMModel[] }>(
      "/llm/v1/models",
    );
    return resp.data || [];
  }

  /** Get current spend and remaining credits. */
  async getUsage(): Promise<LLMUsage> {
    return this.client.get<LLMUsage>("/llm/v1/usage");
  }
}

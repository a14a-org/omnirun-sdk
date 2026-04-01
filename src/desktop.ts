import type { HTTPClient } from "./client.js";

// Types

export interface ScreenInfo {
  width: number;
  height: number;
  cursorX: number;
  cursorY: number;
}

export interface DesktopStreamInfo {
  novncPort: number;
  vncPort: number;
  wsPath: string;
}

export type MouseAction = "click" | "doubleClick" | "rightClick" | "move" | "drag" | "scroll";
export type ScrollDirection = "up" | "down" | "left" | "right";
export type KeyboardAction = "type" | "press";

export interface MouseOptions {
  action: MouseAction;
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  direction?: ScrollDirection;
  amount?: number;
}

export interface KeyboardOptions {
  action: KeyboardAction;
  text?: string;
  key?: string;
}

/** Desktop control namespace for GUI sandboxes. */
export class Desktop {
  private sandboxId: string;
  private client: HTTPClient;

  constructor(sandboxId: string, client: HTTPClient) {
    this.sandboxId = sandboxId;
    this.client = client;
  }

  private get baseUrl(): string {
    return `/sandboxes/${this.sandboxId}/desktop`;
  }

  /** Capture a screenshot of the desktop as a PNG image. */
  async screenshot(): Promise<Uint8Array> {
    return this.client.download(`${this.baseUrl}/screenshot`);
  }

  /** Send a mouse action to the desktop. */
  async mouse(opts: MouseOptions): Promise<void> {
    await this.client.post(`${this.baseUrl}/mouse`, opts);
  }

  /** Send a keyboard action to the desktop. */
  async keyboard(opts: KeyboardOptions): Promise<void> {
    await this.client.post(`${this.baseUrl}/keyboard`, opts);
  }

  /** Get current screen dimensions and cursor position. */
  async getScreen(): Promise<ScreenInfo> {
    const data = await this.client.get<any>(`${this.baseUrl}/screen`);
    return {
      width: data.width ?? 0,
      height: data.height ?? 0,
      cursorX: data.cursorX ?? 0,
      cursorY: data.cursorY ?? 0,
    };
  }

  /** Get streaming connection info (noVNC / VNC ports and WebSocket path). */
  async getStreamInfo(): Promise<DesktopStreamInfo> {
    const data = await this.client.get<any>(`${this.baseUrl}/stream`);
    return {
      novncPort: data.novncPort ?? 0,
      vncPort: data.vncPort ?? 0,
      wsPath: data.wsPath ?? "",
    };
  }

  // ── Convenience methods (E2B parity) ──────────────────────────────────

  /** Left-click at the given coordinates. */
  async leftClick(x: number, y: number): Promise<void> {
    await this.mouse({ action: "click", x, y });
  }

  /** Right-click at the given coordinates. */
  async rightClick(x: number, y: number): Promise<void> {
    await this.mouse({ action: "rightClick", x, y });
  }

  /** Double-click at the given coordinates. */
  async doubleClick(x: number, y: number): Promise<void> {
    await this.mouse({ action: "doubleClick", x, y });
  }

  /** Move the mouse cursor to the given coordinates. */
  async moveMouse(x: number, y: number): Promise<void> {
    await this.mouse({ action: "move", x, y });
  }

  /** Drag from (startX, startY) to (endX, endY). */
  async drag(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    await this.mouse({ action: "drag", x: startX, y: startY, endX, endY });
  }

  /** Scroll in a direction. */
  async scroll(direction: ScrollDirection, amount?: number): Promise<void> {
    await this.mouse({ action: "scroll", direction, amount });
  }

  /** Type text character by character. */
  async type(text: string): Promise<void> {
    await this.keyboard({ action: "type", text });
  }

  /** Press a key or key combination (e.g. "Enter", "ctrl+c"). */
  async press(key: string): Promise<void> {
    await this.keyboard({ action: "press", key });
  }

  /** Get the current screen dimensions. */
  async getScreenSize(): Promise<{ width: number; height: number }> {
    const screen = await this.getScreen();
    return { width: screen.width, height: screen.height };
  }

  /** Get the current cursor position. */
  async getCursorPosition(): Promise<{ x: number; y: number }> {
    const screen = await this.getScreen();
    return { x: screen.cursorX, y: screen.cursorY };
  }
}

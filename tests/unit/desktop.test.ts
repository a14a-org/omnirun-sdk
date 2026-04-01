import { afterEach, describe, expect, it, vi } from "vitest";
import { Sandbox } from "../../src/sandbox.js";

describe("Desktop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockSandboxCreate() {
    return new Response(JSON.stringify({ sandboxID: "sbx_123" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }

  async function createSandbox(fetchMock: ReturnType<typeof vi.fn>) {
    vi.stubGlobal("fetch", fetchMock);
    return Sandbox.create("node-22", {
      apiUrl: "https://api.omnirun.io",
      apiKey: "test-key",
    });
  }

  it("screenshot() returns Uint8Array of PNG data", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockSandboxCreate())
      .mockResolvedValueOnce(
        new Response(pngBytes.buffer, {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      );

    const sandbox = await createSandbox(fetchMock);
    const result = await sandbox.desktop.screenshot();

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(pngBytes);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("/sandboxes/sbx_123/desktop/screenshot");
  });

  it("mouse() sends correct action and coordinates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockSandboxCreate())
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: { "content-type": "application/json" },
        })
      );

    const sandbox = await createSandbox(fetchMock);
    await sandbox.desktop.mouse({ action: "click", x: 100, y: 200 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, opts] = fetchMock.mock.calls[1];
    expect(url).toContain("/sandboxes/sbx_123/desktop/mouse");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ action: "click", x: 100, y: 200 });
  });

  it("keyboard() sends correct action and text", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockSandboxCreate())
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: { "content-type": "application/json" },
        })
      );

    const sandbox = await createSandbox(fetchMock);
    await sandbox.desktop.keyboard({ action: "type", text: "hello world" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, opts] = fetchMock.mock.calls[1];
    expect(url).toContain("/sandboxes/sbx_123/desktop/keyboard");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ action: "type", text: "hello world" });
  });

  it("keyboard() sends correct action and key for press", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockSandboxCreate())
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: { "content-type": "application/json" },
        })
      );

    const sandbox = await createSandbox(fetchMock);
    await sandbox.desktop.keyboard({ action: "press", key: "Enter" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, opts] = fetchMock.mock.calls[1];
    expect(url).toContain("/sandboxes/sbx_123/desktop/keyboard");
    expect(JSON.parse(opts.body)).toEqual({ action: "press", key: "Enter" });
  });

  it("getScreen() returns parsed screen info", async () => {
    const screenData = { width: 1920, height: 1080, cursorX: 500, cursorY: 300 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockSandboxCreate())
      .mockResolvedValueOnce(
        new Response(JSON.stringify(screenData), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

    const sandbox = await createSandbox(fetchMock);
    const result = await sandbox.desktop.getScreen();

    expect(result).toEqual(screenData);
    expect(fetchMock.mock.calls[1][0]).toContain("/sandboxes/sbx_123/desktop/screen");
  });

  it("getStreamInfo() returns connection details", async () => {
    const streamData = { novncPort: 6080, vncPort: 5900, wsPath: "/websockify" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockSandboxCreate())
      .mockResolvedValueOnce(
        new Response(JSON.stringify(streamData), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

    const sandbox = await createSandbox(fetchMock);
    const result = await sandbox.desktop.getStreamInfo();

    expect(result).toEqual(streamData);
    expect(fetchMock.mock.calls[1][0]).toContain("/sandboxes/sbx_123/desktop/stream");
  });

  it("leftClick() calls mouse with correct params", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockSandboxCreate())
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: { "content-type": "application/json" },
        })
      );

    const sandbox = await createSandbox(fetchMock);
    await sandbox.desktop.leftClick(150, 250);

    const [url, opts] = fetchMock.mock.calls[1];
    expect(url).toContain("/sandboxes/sbx_123/desktop/mouse");
    expect(JSON.parse(opts.body)).toEqual({ action: "click", x: 150, y: 250 });
  });

  it("type() calls keyboard with correct params", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockSandboxCreate())
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: { "content-type": "application/json" },
        })
      );

    const sandbox = await createSandbox(fetchMock);
    await sandbox.desktop.type("test input");

    const [url, opts] = fetchMock.mock.calls[1];
    expect(url).toContain("/sandboxes/sbx_123/desktop/keyboard");
    expect(JSON.parse(opts.body)).toEqual({ action: "type", text: "test input" });
  });
});

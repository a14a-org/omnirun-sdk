/**
 * Integration tests for the omnirun TypeScript SDK.
 *
 * Run against a live server:
 *   OMNIRUN_API_URL=https://api.omnirun.io
 *   OMNIRUN_API_KEY=<key>
 *   RUN_OMNIRUN_INTEGRATION=1
 *   npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  Sandbox,
  CommandExitException,
  type CreateSandboxOptions,
} from "../../src/index.js";

const API_URL =
  process.env.OMNIRUN_API_URL || "https://api.omnirun.io";
const API_KEY =
  process.env.OMNIRUN_API_KEY || "";
const RUN_INTEGRATION = process.env.RUN_OMNIRUN_INTEGRATION === "1";
const integrationDescribe = RUN_INTEGRATION && API_KEY ? describe : describe.skip;

const sbxOpts: CreateSandboxOptions = {
  apiUrl: API_URL,
  apiKey: API_KEY,
};

const connectOpts = {
  apiUrl: API_URL,
  apiKey: API_KEY,
};

integrationDescribe("Sandbox Lifecycle", () => {
  it("should create and kill a sandbox", async () => {
    const sbx = await Sandbox.create("python-3.11", sbxOpts);
    try {
      expect(sbx.sandboxId).toBeTruthy();
      expect(sbx.sandboxId.length).toBeGreaterThan(0);
      const running = await sbx.isRunning();
      expect(running).toBe(true);
    } finally {
      await sbx.kill();
    }
  }, 30_000);

  it("should connect to an existing sandbox", async () => {
    const sbx = await Sandbox.create("python-3.11", sbxOpts);
    try {
      const sbx2 = await Sandbox.connect(sbx.sandboxId, connectOpts);
      const running = await sbx2.isRunning();
      expect(running).toBe(true);
    } finally {
      await sbx.kill();
    }
  }, 30_000);

  it("should list sandboxes", async () => {
    const sbx = await Sandbox.create("python-3.11", sbxOpts);
    try {
      const sandboxes = await Sandbox.list(connectOpts);
      const ids = sandboxes.map((s) => s.sandboxId);
      expect(ids).toContain(sbx.sandboxId);
    } finally {
      await sbx.kill();
    }
  }, 30_000);

  it("should set timeout", async () => {
    const sbx = await Sandbox.create("python-3.11", sbxOpts);
    try {
      // should not throw
      await sbx.setTimeout(600);
    } finally {
      await sbx.kill();
    }
  }, 30_000);

  it("should get sandbox info", async () => {
    const sbx = await Sandbox.create("python-3.11", sbxOpts);
    try {
      const info = await sbx.getInfo();
      expect(info).toBeDefined();
    } finally {
      await sbx.kill();
    }
  }, 30_000);
});

integrationDescribe("Commands", () => {
  let sbx: Sandbox;

  beforeAll(async () => {
    sbx = await Sandbox.create("python-3.11", sbxOpts);
  }, 30_000);

  afterAll(async () => {
    try {
      await sbx.kill();
    } catch {
      // ignore
    }
  }, 15_000);

  it("should run echo", async () => {
    const result = await sbx.commands.run("echo hello");
    expect(result.stdout.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
  }, 15_000);

  it("should run python", async () => {
    const result = await sbx.commands.run("python3 -c 'print(42)'");
    expect(result.stdout.trim()).toBe("42");
    expect(result.exitCode).toBe(0);
  }, 15_000);

  it("should raise on non-zero exit", async () => {
    await expect(sbx.commands.run("exit 1")).rejects.toThrow(
      CommandExitException
    );
  }, 15_000);

  it("should respect cwd", async () => {
    const result = await sbx.commands.run("pwd", { cwd: "/tmp" });
    expect(result.stdout.trim()).toBe("/tmp");
  }, 15_000);

  it("should run background command and wait", async () => {
    const handle = await sbx.commands.run("sleep 1 && echo done", {
      background: true,
    });
    expect(handle.pid).toBeGreaterThan(0);
    const result = await handle.wait(30_000);
    expect(result.stdout.trim()).toBe("done");
    expect(result.exitCode).toBe(0);
  }, 30_000);

  it("should stream command output", async () => {
    const chunks: string[] = [];
    // Use a slightly longer command so SSE can connect before it finishes
    const result = await sbx.commands.run("sleep 0.5 && echo streaming", {
      onStdout: (data) => chunks.push(data),
    });
    expect(result.stdout).toContain("streaming");
    expect(chunks.length).toBeGreaterThan(0);
  }, 15_000);

  it("should list processes", async () => {
    const processes = await sbx.commands.list();
    expect(Array.isArray(processes)).toBe(true);
  }, 15_000);

  it("should send stdin to a process", async () => {
    const handle = await sbx.commands.run("cat", { background: true });
    await sbx.commands.sendStdin(handle.pid, "hello from stdin\n");
    // Give it a moment to process
    await new Promise((r) => setTimeout(r, 1000));
    await handle.kill();
  }, 15_000);
});

integrationDescribe("Filesystem", () => {
  let sbx: Sandbox;

  beforeAll(async () => {
    sbx = await Sandbox.create("python-3.11", sbxOpts);
  }, 30_000);

  afterAll(async () => {
    try {
      await sbx.kill();
    } catch {
      // ignore
    }
  }, 15_000);

  it("should write and read a file", async () => {
    await sbx.files.write("/tmp/test.txt", "hello world");
    const content = await sbx.files.read("/tmp/test.txt");
    expect(content).toBe("hello world");
  }, 15_000);

  it("should list directory", async () => {
    await sbx.files.write("/tmp/sdk_test/a.txt", "aaa");
    await sbx.files.write("/tmp/sdk_test/b.txt", "bbb");
    const entries = await sbx.files.list("/tmp/sdk_test");
    const names = entries.map((e) => e.name);
    expect(names).toContain("a.txt");
    expect(names).toContain("b.txt");
  }, 15_000);

  it("should check file existence", async () => {
    await sbx.files.write("/tmp/exists_test.txt", "yes");
    expect(await sbx.files.exists("/tmp/exists_test.txt")).toBe(true);
    expect(await sbx.files.exists("/tmp/nope_not_here.txt")).toBe(false);
  }, 15_000);

  it("should remove a file", async () => {
    await sbx.files.write("/tmp/to_delete.txt", "bye");
    expect(await sbx.files.exists("/tmp/to_delete.txt")).toBe(true);
    await sbx.files.remove("/tmp/to_delete.txt");
    expect(await sbx.files.exists("/tmp/to_delete.txt")).toBe(false);
  }, 15_000);

  it("should create a directory", async () => {
    await sbx.files.makeDir("/tmp/new_dir/sub");
    const entries = await sbx.files.list("/tmp/new_dir");
    const names = entries.map((e) => e.name);
    expect(names).toContain("sub");
  }, 15_000);

  it("should get file info", async () => {
    await sbx.files.write("/tmp/info_test.txt", "test data");
    const info = await sbx.files.info("/tmp/info_test.txt");
    expect(info.name).toBe("info_test.txt");
    expect(info.isDir).toBe(false);
  }, 15_000);

  it("should rename a file", async () => {
    await sbx.files.write("/tmp/old_name.txt", "rename me");
    await sbx.files.rename("/tmp/old_name.txt", "/tmp/new_name.txt");
    expect(await sbx.files.exists("/tmp/new_name.txt")).toBe(true);
    expect(await sbx.files.exists("/tmp/old_name.txt")).toBe(false);
  }, 15_000);

  it("should batch write files", async () => {
    const entries = await sbx.files.write([
      { path: "/tmp/batch/x.txt", content: "xxx" },
      { path: "/tmp/batch/y.txt", content: "yyy" },
    ]);
    expect(Array.isArray(entries)).toBe(true);
    expect(await sbx.files.exists("/tmp/batch/x.txt")).toBe(true);
    expect(await sbx.files.exists("/tmp/batch/y.txt")).toBe(true);
  }, 15_000);
});

integrationDescribe("PTY", () => {
  let sbx: Sandbox;

  beforeAll(async () => {
    sbx = await Sandbox.create("python-3.11", sbxOpts);
  }, 30_000);

  afterAll(async () => {
    try {
      await sbx.kill();
    } catch {
      // ignore
    }
  }, 15_000);

  it("should create and kill a pty session", async () => {
    const session = await sbx.pty.create({ cols: 80, rows: 24 });
    expect(session.pid).toBeGreaterThan(0);

    // List should include the session
    const sessions = await sbx.pty.list();
    expect(sessions.length).toBeGreaterThan(0);

    await session.kill();
  }, 15_000);

  it("should send input and read output", async () => {
    const session = await sbx.pty.create();
    try {
      // Send a command
      await session.sendStdin("echo hello_pty\n");
      // Wait a bit for output
      await new Promise((r) => setTimeout(r, 1000));
      const output = await session.read();
      expect(output).toBeTruthy();
    } finally {
      await session.kill();
    }
  }, 15_000);

  it("should resize a pty session", async () => {
    const session = await sbx.pty.create({ cols: 80, rows: 24 });
    try {
      // Should not throw
      await session.resize(120, 40);
    } finally {
      await session.kill();
    }
  }, 15_000);
});

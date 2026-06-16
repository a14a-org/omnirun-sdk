export class SandboxError extends Error {
  /** HTTP status code that produced this error, if applicable. */
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "SandboxError";
    this.status = status;
  }
}

export class SandboxNotFoundError extends SandboxError {
  constructor(sandboxId: string) {
    super(`Sandbox ${sandboxId} not found`);
    this.name = "SandboxNotFoundError";
  }
}

export class CommandExitException extends SandboxError {
  stdout: string;
  stderr: string;
  exitCode: number;

  constructor(stdout: string, stderr: string, exitCode: number) {
    super(`Command exited with code ${exitCode}: ${stderr || stdout}`);
    this.name = "CommandExitException";
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export class StreamError extends SandboxError {
  constructor(message: string) {
    super(message);
    this.name = "StreamError";
  }
}

export class TimeoutError extends SandboxError {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

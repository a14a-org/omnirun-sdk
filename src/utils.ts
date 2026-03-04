import type { CommandResult } from "./models.js";

/** Create a CommandResult with an `output` getter alias for `stdout`. */
export function makeCommandResult(raw: {
  stdout: string;
  stderr: string;
  exit_code?: number;
  exitCode?: number;
}): CommandResult {
  return {
    stdout: raw.stdout ?? "",
    stderr: raw.stderr ?? "",
    exitCode: raw.exit_code ?? raw.exitCode ?? -1,
    get output() {
      return this.stdout;
    },
  };
}

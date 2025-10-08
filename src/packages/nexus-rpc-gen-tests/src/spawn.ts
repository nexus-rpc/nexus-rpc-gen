import { spawn, type SpawnOptions } from "node:child_process";

export class SpawnResult {
  cmd: string;
  args: string[];
  stdout: string;
  stderr: string;
  code?: number;
  error?: Error;

  constructor(cmd: string, arguments_: string[]) {
    this.cmd = cmd;
    this.args = arguments_;
    this.stdout = "";
    this.stderr = "";
  }

  assertSuccess() {
    if (this.error) {
      throw new Error(`Failed with error ${this.error}`);
    }
    if (this.code !== 0) {
      throw new Error(`Failed with code ${this.code}`);
    }
  }
}

export function spawnAsync(
  cmd: string,
  arguments_: string[] = [],
  options: SpawnOptions = {},
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    console.log(`Running: '${cmd}' with args: ${arguments_.join(" ")}`);
    const proc = spawn(cmd, arguments_, options);
    const result = new SpawnResult(cmd, arguments_);

    proc.stdout?.on("data", (d) => (result.stdout += d));
    proc.stderr?.on("data", (d) => (result.stderr += d));

    proc.on("error", (error) => {
      result.error = error;
      resolve(result);
    });

    proc.on("close", (code) => {
      result.code = code ?? undefined;
      resolve(result);
    });
  });
}

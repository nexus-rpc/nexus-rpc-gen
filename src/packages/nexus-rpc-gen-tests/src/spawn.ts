import { spawn, type SpawnOptions } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../",
);

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

export function runRpcGen(
  arguments_: string[],
  options?: { stdio?: "inherit" | "pipe" },
): Promise<SpawnResult> {
  return spawnAsync("npm", ["run", "cli", "--", ...arguments_], {
    shell: true,
    cwd: packageRoot,
    env: { NEXUS_IDL_DEBUG: "1", ...process.env },
    stdio: options?.stdio ?? "inherit",
  });
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

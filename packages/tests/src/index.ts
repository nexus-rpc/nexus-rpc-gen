import { spawnAsync, type SpawnResult } from "./spawn.js";
import test from "node:test";
import { platform } from "node:os";

test("C#", async () => {
  // Run gen
  (
    await runRpcGen(
      "--lang",
      "cs",
      "--out-dir",
      "packages/tests/languages/cs/NexusServices",
      "packages/tests/definitions/kitchen-sink.nexusrpc.yaml",
    )
  ).assertSuccess();
  // Run C# test suite
  (
    await spawnAsync(
      "dotnet",
      ["test", "--logger", "console;verbosity=detailed"],
      { cwd: "languages/cs", stdio: "inherit" },
    )
  ).assertSuccess();
});

test("Go", async () => {
  // Run gen
  (
    await runRpcGen(
      "--lang",
      "go",
      "--package",
      "services",
      "--out-dir",
      "packages/tests/languages/go/services",
      "packages/tests/definitions/kitchen-sink.nexusrpc.yaml",
    )
  ).assertSuccess();
  // Run Go test suite
  (
    await spawnAsync("go", ["test", "--count", "1", "-p", "1", "-v", "./..."], {
      cwd: "languages/go",
      stdio: "inherit",
    })
  ).assertSuccess();
});

test("Java", async () => {
  // Run gen
  (
    await runRpcGen(
      "--lang",
      "java",
      "--out-dir",
      "packages/tests/languages/java/src/main/java",
      "packages/tests/definitions/kitchen-sink.nexusrpc.yaml",
    )
  ).assertSuccess();
  // Run Java test suite
  const gradle = platform() === "win32" ? "gradlew" : "./gradlew";
  (
    await spawnAsync(gradle, ["test"], {
      shell: true,
      cwd: "languages/java",
      stdio: "inherit",
    })
  ).assertSuccess();
});

test("Python", async () => {
  // Run gen
  (
    await runRpcGen(
      "--lang",
      "py",
      "--out-dir",
      "packages/tests/languages/py/services",
      "packages/tests/definitions/kitchen-sink.nexusrpc.yaml",
    )
  ).assertSuccess();

  // Format, check types, run test
  (
    await spawnAsync("uv", ["run", "ruff", "format"], {
      cwd: "languages/py",
      stdio: "inherit",
    })
  ).assertSuccess();
  (
    await spawnAsync("uv", ["run", "-m", "mypy", "."], {
      cwd: "languages/py",
      stdio: "inherit",
    })
  ).assertSuccess();
  (
    await spawnAsync("uv", ["run", "-m", "pytest", "-s"], {
      cwd: "languages/py",
      stdio: "inherit",
    })
  ).assertSuccess();
});

test("TypeScript", async () => {
  // Run gen
  (
    await runRpcGen(
      "--lang",
      "ts",
      "--out-dir",
      "packages/tests/languages/ts/src/services",
      "packages/tests/definitions/kitchen-sink.nexusrpc.yaml",
    )
  ).assertSuccess();

  // Build TS test suite then run it
  (
    await spawnAsync("npm", ["install"], {
      shell: true,
      cwd: "languages/ts",
      stdio: "inherit",
    })
  ).assertSuccess();
  (
    await spawnAsync("npm", ["run", "build"], {
      shell: true,
      cwd: "languages/ts",
      stdio: "inherit",
    })
  ).assertSuccess();
  (
    await spawnAsync("npm", ["test"], {
      shell: true,
      cwd: "languages/ts",
      stdio: "inherit",
    })
  ).assertSuccess();
});

function runRpcGen(...arguments_: string[]): Promise<SpawnResult> {
  return spawnAsync("npm", ["run", "cli", "--", ...arguments_], {
    shell: true,
    cwd: "../",
    env: { NEXUS_IDL_DEBUG: "1", ...process.env },
    stdio: "inherit",
  });
}

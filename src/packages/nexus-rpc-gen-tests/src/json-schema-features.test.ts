import { runRpcGen, spawnAsync } from "./spawn.js";
import test from "node:test";
import { platform } from "node:os";

const defFiles = [
  // "packages/nexus-rpc-gen-tests/definitions/json-schema-features-types.nexusrpc.yaml",
  "packages/nexus-rpc-gen-tests/definitions/json-schema-features.nexusrpc.yaml",
];

test("JSON Schema Features - TypeScript", async () => {
  (
    await runRpcGen([
      "--lang",
      "ts",
      "--out-dir",
      "packages/nexus-rpc-gen-tests/languages/ts/src/services",
      ...defFiles,
    ])
  ).assertSuccess();
  (
    await spawnAsync("npm", ["install"], {
      cwd: "languages/ts",
      stdio: "inherit",
    })
  ).assertSuccess();
  (
    await spawnAsync("npx", ["tsx", "src/json-schema-features-tests.ts"], {
      cwd: "languages/ts",
      stdio: "inherit",
    })
  ).assertSuccess();
});

test("JSON Schema Features - Go", async () => {
  (
    await runRpcGen([
      "--lang",
      "go",
      "--package",
      "services",
      "--out-dir",
      "packages/nexus-rpc-gen-tests/languages/go/services",
      ...defFiles,
    ])
  ).assertSuccess();
  (
    await spawnAsync(
      "go",
      ["test", "-run", "TestJsonSchemaFeatures", "-v", "./..."],
      {
        cwd: "languages/go",
        stdio: "inherit",
      },
    )
  ).assertSuccess();
});

test("JSON Schema Features - Python", async () => {
  (
    await runRpcGen([
      "--lang",
      "py",
      "--out-dir",
      "packages/nexus-rpc-gen-tests/languages/py/services",
      ...defFiles,
    ])
  ).assertSuccess();
  (
    await spawnAsync(
      "uv",
      ["run", "-m", "pytest", "-s", "-k", "json_schema_features", "-vv"],
      {
        cwd: "languages/py",
        stdio: "inherit",
      },
    )
  ).assertSuccess();
});

test("JSON Schema Features - Java", async () => {
  (
    await runRpcGen([
      "--lang",
      "java",
      "--out-dir",
      "packages/nexus-rpc-gen-tests/languages/java/src/main/java",
      ...defFiles,
    ])
  ).assertSuccess();
  const gradle = platform() === "win32" ? "gradlew" : "./gradlew";
  (
    await spawnAsync(
      gradle,
      ["test", "--tests", "io.nexusrpc.gen.JsonSchemaFeaturesTest"],
      {
        shell: true,
        cwd: "languages/java",
        stdio: "inherit",
      },
    )
  ).assertSuccess();
});

test("JSON Schema Features - C#", async () => {
  (
    await runRpcGen([
      "--lang",
      "cs",
      "--out-dir",
      "packages/nexus-rpc-gen-tests/languages/cs/NexusServices",
      ...defFiles,
    ])
  ).assertSuccess();
  (
    await spawnAsync(
      "dotnet",
      [
        "test",
        "--filter",
        "FullyQualifiedName~JsonSchemaFeaturesTests",
        "--logger",
        "console;verbosity=detailed",
      ],
      {
        cwd: "languages/cs",
        stdio: "inherit",
      },
    )
  ).assertSuccess();
});

import { existsSync } from "node:fs";
import { runRpcGen } from "./spawn.js";
import test, { before } from "node:test";
import assert from "node:assert";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname =
  import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));

const definitionFile =
  "packages/nexus-rpc-gen-tests/definitions/bad-ref/service.nexusrpc.yaml";
const outputDirectory = "packages/nexus-rpc-gen-tests/languages/bad-ref";
const absoluteOutputDirectory = path.resolve(
  __dirname,
  "..",
  "languages",
  "bad-ref",
);

before(async () => {
  await rm(absoluteOutputDirectory, { recursive: true, force: true });
});

test("External $ref to nonexistent file produces a clear error", async () => {
  const result = await runRpcGen(
    ["--lang", "ts", "--out-dir", outputDirectory, definitionFile],
    { stdio: "pipe" },
  );

  assert.notStrictEqual(result.code, 0, "Expected non-zero exit code");
  assert.ok(
    result.stderr.includes("Could not fetch schema"),
    `Expected stderr to mention schema fetch failure, got: ${result.stderr}`,
  );
  assert.ok(
    result.stderr.includes("nonexistent.yaml"),
    `Expected stderr to mention the unresolved ref, got: ${result.stderr}`,
  );

  assert.ok(
    !existsSync(absoluteOutputDirectory),
    `Expected ${absoluteOutputDirectory} to not exist`,
  );
});

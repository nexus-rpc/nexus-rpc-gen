import { existsSync } from "node:fs";
import { runRpcGen } from "./spawn.js";
import test, { before } from "node:test";
import assert from "node:assert";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname =
  import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));

const firstFile =
  "packages/nexus-rpc-gen-tests/definitions/duplicate-service/first.nexusrpc.yaml";
const secondFile =
  "packages/nexus-rpc-gen-tests/definitions/duplicate-service/second.nexusrpc.yaml";
const outputDirectory =
  "packages/nexus-rpc-gen-tests/languages/duplicate-service";
const absoluteOutputDirectory = path.resolve(
  __dirname,
  "..",
  "languages",
  "duplicate-service",
);

before(async () => {
  await rm(absoluteOutputDirectory, { recursive: true, force: true });
});

test("Duplicate service name across files produces an error", async () => {
  const result = await runRpcGen(
    ["--lang", "ts", "--out-dir", outputDirectory, firstFile, secondFile],
    { stdio: "pipe" },
  );

  assert.notStrictEqual(result.code, 0, "Expected non-zero exit code");
  assert.ok(
    result.stderr.includes('Duplicate service "DuplicateService"'),
    `Expected stderr to mention duplicate service, got: ${result.stderr}`,
  );

  assert.ok(
    !existsSync(absoluteOutputDirectory),
    `Expected ${absoluteOutputDirectory} to not exist`,
  );
});

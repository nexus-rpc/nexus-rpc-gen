import { runRpcGen } from "./spawn.js";
import test, { before, after } from "node:test";
import assert from "node:assert";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname =
  import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));

const outputDirectory =
  "packages/nexus-rpc-gen-tests/languages/versioned-go-import";
const absoluteOutputDirectory = path.resolve(
  __dirname,
  "..",
  "languages",
  "versioned-go-import",
);
const definitionFile =
  "packages/nexus-rpc-gen-tests/definitions/versioned-go-import/service.nexusrpc.yaml";

before(async () => {
  await rm(absoluteOutputDirectory, { recursive: true, force: true });
});

after(async () => {
  await rm(absoluteOutputDirectory, { recursive: true, force: true });
});

test("Versioned Go import path gets explicit alias", async () => {
  (
    await runRpcGen([
      "--lang",
      "go",
      "--package",
      "versioned",
      "--out-dir",
      outputDirectory,
      definitionFile,
    ])
  ).assertSuccess();

  const files = await readdir(absoluteOutputDirectory);
  const goFile = files.find((f) => f.endsWith(".go"));
  assert.ok(goFile, "Expected a generated .go file");

  const generated = await readFile(
    path.resolve(absoluteOutputDirectory, goFile),
    "utf8",
  );

  // Versioned path: last component is "v1" which doesn't match the package name
  // "workflowservice", so an explicit alias must be emitted so Go uses "v1" as
  // the identifier (matching the generated code that references v1.SomeType).
  assert.ok(
    generated.includes(`import v1 "go.temporal.io/api/workflowservice/v1"`),
    `Expected explicit alias for versioned import, got:\n${generated}`,
  );
});

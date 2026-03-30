import { runRpcGen } from "./spawn.js";
import test from "node:test";
import assert from "node:assert";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname =
  import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));

const outputDirectory = "packages/nexus-rpc-gen-tests/languages/external-ref";
const definitionFile =
  "packages/nexus-rpc-gen-tests/definitions/external-ref/service.nexusrpc.yaml";

test("External $ref resolves from YAML and JSON files", async () => {
  const absoluteOutputDirectory = path.resolve(
    __dirname,
    "..",
    "languages",
    "external-ref",
  );

  // Clean output dir
  await rm(absoluteOutputDirectory, { recursive: true, force: true });

  // Run gen
  (
    await runRpcGen([
      "--lang",
      "ts",
      "--out-dir",
      outputDirectory,
      definitionFile,
    ])
  ).assertSuccess();

  // Find the generated file
  const files = await readdir(absoluteOutputDirectory);
  const tsFile = files.find((f) => f.endsWith(".ts"));
  assert.ok(tsFile, "Expected a generated .ts file");

  // Read generated file and verify external types are present
  const generated = await readFile(
    path.resolve(absoluteOutputDirectory, tsFile),
    "utf8",
  );

  // Fields from Address type (YAML external ref)
  assert.ok(
    generated.includes("street"),
    "Generated output should contain street field from YAML external ref",
  );
  assert.ok(
    generated.includes("city"),
    "Generated output should contain city field from YAML external ref",
  );

  // Fields from PhoneNumber type (JSON external ref)
  assert.ok(
    generated.includes("countryCode"),
    "Generated output should contain countryCode field from JSON external ref",
  );
  assert.ok(
    generated.includes("number"),
    "Generated output should contain number field from JSON external ref",
  );

  // Clean up
  await rm(absoluteOutputDirectory, { recursive: true, force: true });
});

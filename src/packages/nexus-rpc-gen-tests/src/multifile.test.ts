import { runRpcGen } from "./spawn.js";
import test, { before, after } from "node:test";
import assert from "node:assert";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname =
  import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));

const tsOutputDirectory = "packages/nexus-rpc-gen-tests/languages/multifile";
const absoluteTsOutputDirectory = path.resolve(
  __dirname,
  "..",
  "languages",
  "multifile",
);
const goOutputDirectory = "packages/nexus-rpc-gen-tests/languages/multifile-go";
const absoluteGoOutputDirectory = path.resolve(
  __dirname,
  "..",
  "languages",
  "multifile-go",
);
const greetingFile =
  "packages/nexus-rpc-gen-tests/definitions/multifile/greeting.nexusrpc.yaml";
const echoFile =
  "packages/nexus-rpc-gen-tests/definitions/multifile/echo.nexusrpc.yaml";

before(async () => {
  await rm(absoluteTsOutputDirectory, { recursive: true, force: true });
  await rm(absoluteGoOutputDirectory, { recursive: true, force: true });
});

after(async () => {
  await rm(absoluteTsOutputDirectory, { recursive: true, force: true });
  await rm(absoluteGoOutputDirectory, { recursive: true, force: true });
});

test("Multiple nexusrpc files generate services from all files (TypeScript)", async () => {
  // Run gen with both files
  (
    await runRpcGen([
      "--lang",
      "ts",
      "--out-dir",
      tsOutputDirectory,
      greetingFile,
      echoFile,
    ])
  ).assertSuccess();

  // Read all generated .ts files
  const files = await readdir(absoluteTsOutputDirectory);
  const tsFiles = files.filter((f) => f.endsWith(".ts"));
  assert.ok(tsFiles.length > 0, "Expected at least one generated .ts file");

  const generated = (
    await Promise.all(
      tsFiles.map((f) =>
        readFile(path.resolve(absoluteTsOutputDirectory, f), "utf8"),
      ),
    )
  ).join("\n");

  // GreetingService from greeting.nexusrpc.yaml
  assert.ok(
    generated.includes("GreetingService"),
    "Generated output should contain GreetingService",
  );
  assert.ok(
    generated.includes("sayHello"),
    "Generated output should contain sayHello operation",
  );
  assert.ok(
    generated.includes("message"),
    "Generated output should contain message field from Greeting type",
  );

  // EchoService from echo.nexusrpc.yaml
  assert.ok(
    generated.includes("EchoService"),
    "Generated output should contain EchoService",
  );
  assert.ok(
    generated.includes("echo"),
    "Generated output should contain echo operation",
  );
  assert.ok(
    generated.includes("payload"),
    "Generated output should contain payload field from EchoRequest type",
  );
  assert.ok(
    generated.includes("echoed"),
    "Generated output should contain echoed field from EchoResponse type",
  );

  // Should NOT contain filename-derived type exports
  assert.ok(
    !generated.match(/\.nexusrpc\.yaml/),
    "Generated output should not contain filename-derived type references (.nexusrpc.yaml)",
  );
});

test("Multiple nexusrpc files generate services from all files (Go)", async () => {
  // Run gen with both files
  (
    await runRpcGen([
      "--lang",
      "go",
      "--out-dir",
      goOutputDirectory,
      greetingFile,
      echoFile,
    ])
  ).assertSuccess();

  // Read all generated .go files
  const files = await readdir(absoluteGoOutputDirectory);
  const goFiles = files.filter((f) => f.endsWith(".go"));
  assert.ok(goFiles.length > 0, "Expected at least one generated .go file");

  const generated = (
    await Promise.all(
      goFiles.map((f) =>
        readFile(path.resolve(absoluteGoOutputDirectory, f), "utf8"),
      ),
    )
  ).join("\n");

  // Both services should be present
  assert.ok(
    generated.includes("EchoService"),
    "Generated output should contain EchoService",
  );
  assert.ok(
    generated.includes("GreetingService"),
    "Generated output should contain GreetingService",
  );

  // Should NOT contain filename-derived type declarations
  assert.ok(
    !generated.match(/NexusrpcYAML|NexusrpcYaml/i),
    "Generated output should not contain filename-derived types (NexusrpcYAML)",
  );
});

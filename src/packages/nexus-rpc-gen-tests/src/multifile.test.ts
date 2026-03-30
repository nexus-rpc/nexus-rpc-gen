import { runRpcGen } from "./spawn.js";
import test from "node:test";
import assert from "node:assert";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname =
  import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));

const outputDirectory = "packages/nexus-rpc-gen-tests/languages/multifile";
const greetingFile =
  "packages/nexus-rpc-gen-tests/definitions/multifile/greeting.nexusrpc.yaml";
const echoFile =
  "packages/nexus-rpc-gen-tests/definitions/multifile/echo.nexusrpc.yaml";

test("Multiple nexusrpc files generate services from all files", async () => {
  const absoluteOutputDirectory = path.resolve(
    __dirname,
    "..",
    "languages",
    "multifile",
  );

  // Clean output dir
  await rm(absoluteOutputDirectory, { recursive: true, force: true });

  // Run gen with both files
  (
    await runRpcGen([
      "--lang",
      "ts",
      "--out-dir",
      outputDirectory,
      greetingFile,
      echoFile,
    ])
  ).assertSuccess();

  // Read all generated .ts files
  const files = await readdir(absoluteOutputDirectory);
  const tsFiles = files.filter((f) => f.endsWith(".ts"));
  assert.ok(tsFiles.length > 0, "Expected at least one generated .ts file");

  const generated = (
    await Promise.all(
      tsFiles.map((f) =>
        readFile(path.resolve(absoluteOutputDirectory, f), "utf8"),
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

  // Clean up
  await rm(absoluteOutputDirectory, { recursive: true, force: true });
});

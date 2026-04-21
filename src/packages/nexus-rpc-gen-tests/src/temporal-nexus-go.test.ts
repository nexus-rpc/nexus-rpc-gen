import test from "node:test";
import assert from "node:assert/strict";
import { runRpcGen } from "./spawn.js";

const temporalSchema =
  "packages/nexus-rpc-gen-tests/definitions/temporal-system-nexus.nexusrpc.yaml";

test("Go temporal nexus payload codec support is optional", async () => {
  const withoutFlag = await runRpcGen(
    ["--lang", "go", "--dry-run", "--package", "json", temporalSchema],
    { stdio: "pipe" },
  );
  withoutFlag.assertSuccess();
  assert.ok(
    !withoutFlag.stdout.includes("TemporalNexusPayloadVisitors"),
    "registry should not be emitted without the generic flag",
  );

  const withFlag = await runRpcGen(
    [
      "--lang",
      "go",
      "--dry-run",
      "--package",
      "json",
      "--temporal-nexus-payload-codec-support",
      temporalSchema,
    ],
    { stdio: "pipe" },
  );
  withFlag.assertSuccess();
  assert.ok(
    withFlag.stdout.includes("var TemporalNexusPayloadVisitors ="),
    "registry should be emitted when the generic flag is enabled",
  );
  assert.ok(
    withFlag.stdout.includes("InputType func() any"),
    "registry entries should carry the input allocator alongside the visitor",
  );
  assert.ok(
    withFlag.stdout.includes("func GetTemporalNexusPayloadVisitor("),
    "payload visitor getter should be emitted when payload codec support is enabled",
  );
  assert.ok(
    withFlag.stdout.includes(
      '{ServiceName: "WorkflowService", OperationName: "SignalWithStartWorkflowExecution"}',
    ),
    "registry should be keyed by service and operation",
  );
  assert.ok(
    withFlag.stdout.includes("typedValue, ok := value.(*"),
    "operation visitor should receive a typed generated input",
  );
  assert.ok(
    withFlag.stdout.includes(
      "func (r *temporalNexusPayloadVisitor) visitUserMetadata(",
    ),
    "user metadata should have a structural visitor helper",
  );
  assert.ok(
    withFlag.stdout.includes(
      "visitedValue, err := r.visitPayload(visited.Details)",
    ),
    "payload fields should be visited structurally",
  );
  assert.ok(
    withFlag.stdout.includes(
      "visitedValue, err := r.visitPayloads(visited.Input)",
    ) && withFlag.stdout.includes("visited.Input = visitedValue"),
    "request input payloads should be visited structurally",
  );
  assert.ok(
    withFlag.stdout.includes(
      "func (r *temporalNexusPayloadVisitor) visitSearchAttributes(",
    ),
    "search attributes should have a structural visitor helper",
  );
  assert.ok(
    withFlag.stdout.includes("if !r.shouldVisitSearchAttributes {"),
    "search attribute rewriting should be opt-in",
  );
  assert.ok(
    withFlag.stdout.includes("type temporalNexusPayloadVisitor struct {"),
    "generated helpers should be grouped in an object",
  );
});

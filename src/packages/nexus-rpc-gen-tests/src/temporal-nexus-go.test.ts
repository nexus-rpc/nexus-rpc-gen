import test from "node:test";
import assert from "node:assert/strict";
import { runRpcGen } from "./spawn.js";

const temporalSchema =
  "../../temporal-api/nexus/temporal-json-schema-models-nexusrpc.yaml";

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
    withFlag.stdout.includes(
      "typedValue, ok := value.(*WorkflowServiceSignalWithStartWorkflowExecutionInput)",
    ),
    "operation visitor should receive the typed generated input",
  );
  assert.ok(
    withFlag.stdout.includes(
      "func (r *temporalNexusPayloadVisitor) visitUserMetadata(",
      ),
    "user metadata should have a structural visitor helper",
  );
  assert.ok(
    withFlag.stdout.includes(
      'visitedValue, err := r.visitPayloadJSON(visited.Details)',
    ),
    "payload fields should be visited structurally",
  );
  assert.ok(
    withFlag.stdout.includes(
      "visited.Payloads = visitedValue",
    ),
    "input payload arrays should be visited through the payloads field",
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
  assert.ok(
    withFlag.stdout.includes("type Payload = any"),
    "named payload schema should be preserved in the generated Go model",
  );
  assert.ok(
    withFlag.stdout.includes("type Payloads struct {"),
    "named payloads schema should be preserved in the generated Go model",
  );
  assert.ok(
    withFlag.stdout.includes("Payloads []Payload `json:\"payloads,omitempty\"`"),
    "payload arrays should use the named payload type",
  );
  assert.ok(
    withFlag.stdout.includes("type Input = Payloads"),
    "the schema-specific input wrapper should alias the named payloads type",
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { runRpcGen } from "./spawn.js";

const temporalSchema =
  "packages/nexus-rpc-gen-tests/definitions/temporal-system-nexus.nexusrpc.yaml";
const temporalMultiServiceSchema =
  "packages/nexus-rpc-gen-tests/definitions/temporal-multi-service.nexusrpc.yaml";

test("Python temporal nexus payload codec support is optional", async () => {
  const withoutFlag = await runRpcGen(
    ["--lang", "py", "--dry-run", temporalSchema],
    { stdio: "pipe" },
  );
  withoutFlag.assertSuccess();
  assert.ok(
    !withoutFlag.stdout.includes("__temporal_nexus_payload_visitors__"),
    "registry should not be emitted without the generic flag",
  );

  const withFlag = await runRpcGen(
    [
      "--lang",
      "py",
      "--dry-run",
      "--temporal-nexus-payload-codec-support",
      temporalSchema,
    ],
    { stdio: "pipe" },
  );
  withFlag.assertSuccess();
  assert.ok(
    withFlag.stdout.includes("__temporal_nexus_payload_visitors__"),
    "registry should be emitted when the generic flag is enabled",
  );
  assert.ok(
    !withFlag.stdout.includes("_temporal_nexus_encode_json_value"),
    "generated Python should use structural visitors instead of a generic JSON walk",
  );
  assert.ok(
    withFlag.stdout.includes(
      '("WorkflowService", "SignalWithStartWorkflowExecution")',
    ),
    "registry should be keyed by service and operation",
  );
  assert.ok(
    withFlag.stdout.includes(
      "__nexus_operation_registry__: dict[tuple[str, str], Operation[typing.Any, typing.Any]] = {",
    ),
    "generated Python should emit an operation registry",
  );
  assert.ok(
    withFlag.stdout.includes("@dataclass"),
    "generated Python models should use dataclasses",
  );
  assert.ok(
    withFlag.stdout.includes("workflow_id: Optional[str] = None"),
    "generated Python models should use snake_case field names",
  );
  assert.ok(
    !withFlag.stdout.includes("Field("),
    "generated Python models should not rely on pydantic Field metadata",
  );
  assert.ok(
    withFlag.stdout.includes(
      "async def _temporal_nexus_visit_user_metadata_json(",
    ),
    "user metadata should have a structural visitor helper",
  );
  assert.ok(
    withFlag.stdout.includes(
      'visited["summary"] = await self._visit_payload_json(',
    ),
    "user metadata summary should be visited structurally",
  );
  assert.ok(
    withFlag.stdout.includes(
      'visited["userMetadata"] = await self._temporal_nexus_visit_user_metadata_json',
    ),
    "root input should structurally visit nested user metadata",
  );
  assert.ok(
    withFlag.stdout.includes(
      "async def _temporal_nexus_visit_search_attributes_json(",
    ),
    "search attributes should have a structural visitor helper",
  );
  assert.ok(
    withFlag.stdout.includes("if not self._visit_search_attributes:"),
    "search attribute visiting should be opt-in",
  );
  assert.ok(
    withFlag.stdout.includes("class _TemporalNexusPayloadVisitor:"),
    "generated helpers should be grouped in an object",
  );
});

test("Python temporal nexus payload visitor registry supports multiple services and operations", async () => {
  const result = await runRpcGen(
    [
      "--lang",
      "py",
      "--dry-run",
      "--temporal-nexus-payload-codec-support",
      temporalMultiServiceSchema,
    ],
    { stdio: "pipe" },
  );
  result.assertSuccess();
  for (const key of [
    '("FirstService", "OpOne")',
    '("FirstService", "OpTwo")',
    '("SecondService", "OpThree")',
  ]) {
    assert.ok(result.stdout.includes(key), `registry should include ${key}`);
  }
  assert.equal(
    result.stdout.match(/\(".*?", ".*?"\): _temporal_nexus_visit_/g)?.length,
    3,
    "registry should contain exactly one entry per service/operation pair",
  );
});

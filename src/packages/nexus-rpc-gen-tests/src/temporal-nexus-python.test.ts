import test from "node:test";
import assert from "node:assert/strict";
import { runRpcGen } from "./spawn.js";

const temporalSchema =
  "../../temporal-api/nexus/temporal-json-schema-models-nexusrpc.yaml";

test("Python temporal nexus payload codec support is optional", async () => {
  const withoutFlag = await runRpcGen(
    ["--lang", "py", "--dry-run", temporalSchema],
    { stdio: "pipe" },
  );
  withoutFlag.assertSuccess();
  assert.ok(
    !withoutFlag.stdout.includes("__temporal_nexus_payload_rewriters__"),
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
    withFlag.stdout.includes("__temporal_nexus_payload_rewriters__"),
    "registry should be emitted when the generic flag is enabled",
  );
  assert.ok(
    !withFlag.stdout.includes("_temporal_nexus_encode_json_value"),
    "generated Python should use structural rewriters instead of a generic JSON walk",
  );
  assert.ok(
    withFlag.stdout.includes(
      '("WorkflowService", "SignalWithStartWorkflowExecution")',
    ),
    "registry should be keyed by service and operation",
  );
  assert.ok(
    withFlag.stdout.includes('alias="workflowId"'),
    "generated Python models should validate aliased JSON fields",
  );
  assert.ok(
    withFlag.stdout.includes(
      "async def _temporal_nexus_rewrite_user_metadata_json(",
    ),
    "user metadata should have a structural rewriter helper",
  );
  assert.ok(
    withFlag.stdout.includes(
      'rewritten["summary"] = await self._rewrite_payload_json(',
    ),
    "user metadata summary should be rewritten structurally",
  );
  assert.ok(
    withFlag.stdout.includes(
      'rewritten["userMetadata"] = await self._temporal_nexus_rewrite_user_metadata_json',
    ),
    "root input should structurally rewrite nested user metadata",
  );
  assert.ok(
    withFlag.stdout.includes(
      "async def _temporal_nexus_rewrite_search_attributes_json(",
    ),
    "search attributes should have a structural rewriter helper",
  );
  assert.ok(
    withFlag.stdout.includes("if not self._visit_search_attributes:"),
    "search attribute rewriting should be opt-in",
  );
  assert.ok(
    withFlag.stdout.includes("class _TemporalNexusPayloadRewriter:"),
    "generated helpers should be grouped in an object",
  );
});

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
    !withoutFlag.stdout.includes("__temporal_nexus_payload_codec_rewriters__"),
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
    withFlag.stdout.includes("__temporal_nexus_payload_codec_rewriters__"),
    "registry should be emitted when the generic flag is enabled",
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
});

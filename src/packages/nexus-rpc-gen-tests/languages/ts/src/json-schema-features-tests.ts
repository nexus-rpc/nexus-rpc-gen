import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type JSONSchemaFeaturesPayload,
  type HistoryEvent,
  Action,
} from "./services/JsonSchemaFeaturesService.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturePath = resolve(
  __dirname,
  "../../../definitions/json-schema-features-payload.json",
);
const fixtureJson = readFileSync(fixturePath, "utf8");

// Construct the payload programmatically using generated types.
const payload: JSONSchemaFeaturesPayload = {
  id: "RPC-001",
  count: 5,
  price: 29.5,
  active: true,
  status: "active" as any,
  tags: ["urgent", "reviewed"],
  metadata: { source: "api", region: "us-east-1" },
  fixedKind: "payload" as any,
  timestamp: "2026-04-09T12:00:00Z",
  scoreMatrix: [
    [1, 2.5],
    [3, 4.5],
    [5, 6.5],
  ],
  nullableNote: null,
  variant: "beta",
  pet: { kind: "dog" as any, breed: "herding" as any },
  contact: { method: "email" as any, email: "alice@example.com" },
  address: {
    line1: "123 Main St",
    city: "Springfield",
    countryCode: "US",
    postalCode: "62704",
    residential: true,
    instructions: "Leave at front door",
  },
  manager: {
    name: "Bob Smith",
    email: "bob@example.com",
    department: "Engineering",
    reports: 8,
  },
  history: [
    {
      at: "2026-01-15T09:30:00Z",
      action: Action.Created,
      actor: "alice",
    },
    {
      at: "2026-03-22T14:15:00Z",
      action: Action.Updated,
      actor: 42,
    },
  ],
};

// Serialize, parse both sides, compare.
const actual = JSON.parse(JSON.stringify(payload));
const expected = JSON.parse(fixtureJson);
assert.deepStrictEqual(actual, expected);

console.log("TypeScript json-schema-features test passed");

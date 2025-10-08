import test from "node:test";
import * as nexus from "nexus-rpc";
import { kitchenSinkService } from "./services/kitchen-sink.js";
import assert from "node:assert";

const kitchenSinkHandler = nexus.serviceHandler(kitchenSinkService, {
  scalarArgScalarResult: async (_context, input) => input.length,
  complexArgComplexResultInline: async (_context, { string }) => ({
    characterCount: string?.length,
  }),
  scalarArgScalarResultExternal: async (_context, _input) => {
    throw new Error("Not implemented");
  },
  complexArgComplexResultExternal: async (_context, _input) => {
    throw new Error("Not implemented");
  },
});

const jsonSerializer = {
  serialize(value: unknown) {
    return {
      headers: {},
      data: new TextEncoder().encode(JSON.stringify(value)),
    };
  },
  deserialize<T = unknown>(content: nexus.Content): T {
    return JSON.parse(new TextDecoder().decode(content.data));
  },
};

test("Simple kitchenSink service", async () => {
  // Test two method implementations

  const registry = nexus.ServiceRegistry.create([kitchenSinkHandler]);
  const defaultContext = {
    service: "KitchenSinkService",
    headers: {},
    abortSignal: new AbortController().signal,
    inboundLinks: [],
    outboundLinks: [],
  };

  const scalarResult = await registry.start(
    { ...defaultContext, operation: "scalarArgScalarResult" },
    lazyValueFromText('"some string"'),
  );
  assert(!scalarResult.isAsync);
  assert.equal(scalarResult.value, "some string".length);

  const complexResult = await registry.start(
    { ...defaultContext, operation: "complexArgComplexResultInline" },
    lazyValueFromText('{ "string": "some other string" }'),
  );
  assert(!complexResult.isAsync);
  assert.equal(complexResult.value.characterCount, "some other string".length);
});

function lazyValueFromText(string_: string) {
  return new nexus.LazyValue(
    jsonSerializer,
    {},
    // ReadableStream.from not avail in TS DOM type
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(string_));
        controller.close();
      },
    }),
  );
}

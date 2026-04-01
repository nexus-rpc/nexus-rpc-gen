import type { DefinitionSchema } from "./definition-schema.js";
import type { DefinitionSource } from "./definition-source.js";

import jsonSchema from "../schemas/nexus-rpc-gen.json" with { type: "json" };
import Ajv from "ajv";
import addFormats from "ajv-formats";
import yaml from "yaml";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  loadSchema: async (uri) => {
    // TODO(cretz): This
    throw new Error(`Unable to load remote schema at ${uri} at this time`);
  },
});

addFormats(ajv);

async function parseFile(file: string): Promise<DefinitionSource> {
  const document = yaml.parse(await readFile(file, "utf8"));

  // Validate. We recreate the validator because it carries state.
  const valueFunction = await ajv.compileAsync<DefinitionSchema>(jsonSchema);
  if (!valueFunction(document)) {
    for (const error of valueFunction.errors ?? []) {
      console.log(error);
    }
    throw new Error(
      `Found ${valueFunction.errors?.length} error(s): ` +
        valueFunction.errors
          ?.map(
            (error) =>
              `${error.instancePath || "(root)"}: ${error.message} (${JSON.stringify(error.params)})`,
          )
          .join(", "),
    );
  }
  return { fileURI: pathToFileURL(file), schema: document };
}

export async function parseFiles(files: string[]): Promise<DefinitionSource[]> {
  if (files.length === 0) {
    throw new Error("Must have at least 1 file");
  }

  const results = await Promise.allSettled(files.map(parseFile));
  const errors: Error[] = [];
  const sources: DefinitionSource[] = [];

  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    if (result.status === "rejected") {
      errors.push(
        new Error(`${files[index]}: ${result.reason}`, {
          cause: result.reason,
        }),
      );
    } else {
      sources.push(result.value);
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `Failed to parse ${errors.length} file(s)`,
    );
  }

  return sources;
}

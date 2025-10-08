import type { DefinitionSchema } from "./definition-schema.js";

import jsonSchema from "../../../../schemas/nexus-rpc-gen.json" with { type: "json" };
import Ajv from "ajv";
import addFormats from "ajv-formats";
import yaml from "yaml";
import { readFile } from "node:fs/promises";

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  loadSchema: async (uri) => {
    // TODO(cretz): This
    throw new Error(`Unable to load remote schema at ${uri} at this time`);
  },
});

addFormats(ajv);

export async function parseFiles(files: string[]): Promise<DefinitionSchema> {
  // TODO(cretz): Multi-file
  if (files.length != 1) {
    throw new Error("Must have only 1 file at this time");
  }

  // Parse YAML
  const document = yaml.parse(await readFile(files[0], "utf8"));

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

  return document;
}

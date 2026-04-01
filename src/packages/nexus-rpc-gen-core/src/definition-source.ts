import type { DefinitionSchema } from "./definition-schema.js";

export interface DefinitionSource {
  fileURI: URL;
  schema: DefinitionSchema;
}

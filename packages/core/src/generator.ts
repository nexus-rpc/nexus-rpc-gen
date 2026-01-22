import {
  InputData,
  JSONSchemaInput,
  JSONSchemaStore,
  quicktypeMultiFile,
  Ref,
  type JSONSchema,
  type LanguageName,
  type RendererOptions,
  type TargetLanguage,
} from "quicktype-core";
import type { DefinitionSchema } from "./definition-schema";
import { PathElementKind } from "quicktype-core/dist/input/PathElement.js";
import { isPrimitiveTypeKind } from "quicktype-core/dist/Type/index.js";

export interface GeneratorOptions<Lang extends LanguageName = LanguageName> {
  lang: TargetLanguage;
  schema: DefinitionSchema;
  rendererOptions: RendererOptions<Lang>;
  // Used to help with ideal output filename
  firstFilenameSansExtensions: string;
}

export interface PreparedSchema {
  services: { [key: string]: PreparedService };
  sharedJsonSchema: { types: { [key: string]: any } };
  topLevelJsonSchemaTypes: { [key: string]: any };
  topLevelJsonSchemaLocalRefs: { [key: string]: any };
}

export interface PreparedService {
  description?: string;
  operations: { [key: string]: PreparedOperation };
}

export interface PreparedOperation {
  description?: string;
  input?: PreparedTypeReference;
  output?: PreparedTypeReference;
}

export interface PreparedTypeReference {
  kind: "jsonSchema" | "existing";
  name: string;
}

export interface NexusRendererOptions {
  nexusSchema: PreparedSchema;
  firstFilenameSansExtensions: string;
}

export function getNexusRendererOptions(
  rendererOptions: RendererOptions,
): NexusRendererOptions {
  return (rendererOptions as any).nexusOptions;
}

export class Generator {
  private readonly options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  async generate(): Promise<{ [fileName: string]: string }> {
    // Prepare schema
    const schema = this.prepareSchema();

    // Build quicktype input
    const schemaInput = new JSONSchemaInput(new FetchDisabledSchemaStore());
    const jsonSchema = {
      ...schema.sharedJsonSchema,
      ...schema.topLevelJsonSchemaTypes,
    };
    await schemaInput.addSource({
      // TODO(cretz): Give proper filename name here for proper cross-file referencing
      name: "__ALL_TYPES__",
      schema: JSON.stringify(jsonSchema),
    });
    // Set the top-level types
    for (const topLevel of Object.keys(schema.topLevelJsonSchemaTypes)) {
      schemaInput.addTopLevel(
        topLevel,
        Ref.parse(`__ALL_TYPES__#/${topLevel}`),
      );
    }
    for (const [name, reference] of Object.entries(
      schema.topLevelJsonSchemaLocalRefs,
    )) {
      schemaInput.addTopLevel(name, Ref.parse(`__ALL_TYPES__${reference}`));
    }
    const inputData = new InputData();
    inputData.addInput(schemaInput);

    // Update renderer options with the prepared schema
    const rendererOptions = {
      nexusOptions: {
        nexusSchema: schema,
        firstFilenameSansExtensions: this.options.firstFilenameSansExtensions,
      },
      ...this.options.rendererOptions,
    };

    // Run quicktype and return
    const returnValue: { [fileName: string]: string } = {};
    const results = await quicktypeMultiFile({
      inputData,
      lang: this.options.lang,
      rendererOptions,
    });
    results.forEach(
      (contents, fileName) =>
        (returnValue[fileName] = contents.lines.join("\n")),
    );
    return returnValue;
  }

  private prepareSchema(): PreparedSchema {
    const schema: PreparedSchema = {
      services: {},
      sharedJsonSchema: {
        types: this.options.schema.types ?? {},
      },
      topLevelJsonSchemaTypes: {},
      topLevelJsonSchemaLocalRefs: {},
    };
    for (const [serviceName, service] of Object.entries(
      this.options.schema.services || {},
    )) {
      schema.services[serviceName] = {
        description: service.description,
        operations: {},
      };
      for (const [operationName, operation] of Object.entries(
        service.operations,
      )) {
        const schemaOp: PreparedOperation = {
          description: operation.description,
        };
        schema.services[serviceName].operations[operationName] = schemaOp;
        if (operation.input) {
          schemaOp.input = this.prepareInOutType(
            schema,
            serviceName,
            operationName,
            operation.input,
            "Input",
          );
        }
        if (operation.output) {
          schemaOp.output = this.prepareInOutType(
            schema,
            serviceName,
            operationName,
            operation.output,
            "Output",
          );
        }
      }
    }
    return schema;
  }

  private prepareInOutType(
    schema: PreparedSchema,
    serviceName: string,
    operationName: string,
    opInOut: any,
    suffix: string,
  ): PreparedTypeReference {
    // Check for an existing ref for this specific lang first
    for (const langName of this.options.lang.names) {
      if (Object.hasOwn(opInOut, `$${langName.toLowerCase()}Ref`)) {
        return {
          kind: "existing",
          name: opInOut[`$${langName.toLowerCase()}Ref`],
        };
      }
    }

    // If it's a single ref of a local "#" type, just set as reference
    if (Object.hasOwn(opInOut, "$ref") && opInOut["$ref"].startsWith("#")) {
      const reference = Ref.parse(opInOut["$ref"]);
      const other = reference.lookupRef(schema.sharedJsonSchema) as {
        title?: string;
      };
      if (other) {
        // Default to the title, otherwise last element in path if it's a string key
        let name = other.title;
        if (!name) {
          const lastReferenceElement = reference.path.at(-1);
          if (lastReferenceElement?.kind == PathElementKind.KeyOrIndex) {
            name = lastReferenceElement.key;
          }
        }
        // Only ref it if there is a name
        if (name) {
          // TODO(cretz): Check that this doesn't clash with something already there
          schema.topLevelJsonSchemaLocalRefs[name] = opInOut["$ref"];
          return { kind: "jsonSchema", name };
        }
      }
    }
    // TODO(cretz): Customization of generated names
    // TODO(cretz): Remove the service name prefix by default
    const name = `${serviceName}${operationName[0].toUpperCase()}${operationName.slice(1)}${suffix}`;
    if (Object.hasOwn(schema.topLevelJsonSchemaTypes, name)) {
      throw new Error(
        `Input/output for ${serviceName}.${operationName} would be named ${name} which clashes`,
      );
    }
    schema.topLevelJsonSchemaTypes[name] = opInOut;
    return { kind: "jsonSchema", name };
  }
}

class FetchDisabledSchemaStore extends JSONSchemaStore {
  fetch(_address: string): Promise<JSONSchema | undefined> {
    // TODO(cretz): Support this?
    throw new Error("External $ref unsupported");
  }
}

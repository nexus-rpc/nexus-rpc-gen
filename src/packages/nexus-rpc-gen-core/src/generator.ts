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
import type { DefinitionSource } from "./definition-source.js";
import { PathElementKind } from "quicktype-core/dist/input/PathElement.js";
import { readFile } from "node:fs/promises";
import yaml from "yaml";

export interface GeneratorOptions<Lang extends LanguageName = LanguageName> {
  lang: TargetLanguage;
  definitionSources: DefinitionSource[];
  rendererOptions: RendererOptions<Lang>;
  // Used to help with ideal output filename
  firstFilenameSansExtensions: string;
}

export interface PreparedSchemaSources {
  sources: PreparedSchema[];
}

export interface PreparedSchema {
  sourceURI: string;
  services: { [key: string]: PreparedService };
  sharedJsonSchema: { types: { [key: string]: any } };
  topLevelJsonSchemaTypes: { [key: string]: any };
  topLevelJsonSchemaLocalRefs: { [key: string]: any };
  goProtoRefs: { [key: string]: string };
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

export interface MergedSources {
  services: { [key: string]: PreparedService };
  topLevelJsonSchemaTypes: { [key: string]: any };
  goProtoRefs: { [key: string]: string };
}

export interface NexusRendererOptions {
  nexusSchema: MergedSources;
  firstFilenameSansExtensions: string;
  temporalNexusPayloadCodecSupport: boolean;
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
    const sources = this.prepareSchemas();
    const mergedSources: MergedSources = {
      services: {},
      topLevelJsonSchemaTypes: {},
      goProtoRefs: {},
    };

    // Build quicktype input
    const schemaInput = new JSONSchemaInput(new LocalFetchingSchemaStore());
    for (const schema of sources.sources) {
      const jsonSchema = {
        // Set title to end with __ALL_TYPES__ so quicktype uses this name for the
        // top-level entry even with multiple sources (otherwise it falls back
        // to the filename, creating spurious types like "example.nexusrpc.yaml")
        title: schema.sourceURI.toString() + "/__ALL_TYPES__",
        ...schema.sharedJsonSchema,
        ...schema.topLevelJsonSchemaTypes,
      };
      await schemaInput.addSource({
        // Append __ALL_TYPES__ to make it easier to filter out top level
        // while rendering
        name: schema.sourceURI.toString() + "/__ALL_TYPES__",
        uris: [schema.sourceURI],
        schema: JSON.stringify(jsonSchema),
      });
      // Set the top-level types
      for (const topLevel of Object.keys(schema.topLevelJsonSchemaTypes)) {
        schemaInput.addTopLevel(
          topLevel,
          Ref.parse(`${schema.sourceURI}#/${topLevel}`),
        );
      }
      for (const [name, reference] of Object.entries(
        schema.topLevelJsonSchemaLocalRefs,
      )) {
        schemaInput.addTopLevel(
          name,
          Ref.parse(`${schema.sourceURI}${reference}`),
        );
      }
      mergeSources(mergedSources, schema);
    }
    const inputData = new InputData();
    inputData.addInput(schemaInput);

    // Update renderer options with the prepared schema
    const rendererOptions = {
      nexusOptions: {
        nexusSchema: mergedSources,
        firstFilenameSansExtensions: this.options.firstFilenameSansExtensions,
        temporalNexusPayloadCodecSupport: Boolean(
          (this.options.rendererOptions as Record<string, unknown>)[
            "temporal-nexus-payload-codec-support"
          ],
        ),
      },
      ...this.options.rendererOptions,
    };

    // Run quicktype and return
    const returnValue: { [fileName: string]: string } = {};
    try {
      const results = await quicktypeMultiFile({
        inputData,
        lang: this.options.lang,
        rendererOptions,
      });
      results.forEach(
        (contents, fileName) =>
          (returnValue[fileName] = contents.lines.join("\n")),
      );
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "properties" in error &&
        (error as any).messageName === "SchemaFetchError"
      ) {
        // If there is an error with schema fetching, the message
        // produced by quicktype will use an empty string for the address.
        const { address, base } = (error as any).properties;
        throw new Error(
          `Could not fetch schema "${address}", referred to from ${base}`,
        );
      }
      throw error;
    }
    return returnValue;
  }

  private prepareSchemas(): PreparedSchemaSources {
    const prepared: PreparedSchemaSources = {
      sources: [],
    };

    for (const definitionSource of this.options.definitionSources) {
      const sharedTypes = definitionSource.schema.types ?? {};
      const schema: PreparedSchema = {
        sourceURI: definitionSource.fileURI.toString(),
        services: {},
        sharedJsonSchema: {
          types: sharedTypes,
        },
        topLevelJsonSchemaTypes: {},
        topLevelJsonSchemaLocalRefs: {},
        goProtoRefs: {},
      };
      collectProtoRefs(schema.goProtoRefs, sharedTypes, "$goProtoRef");
      for (const typeName of Object.keys(sharedTypes)) {
        if (Object.hasOwn(schema.topLevelJsonSchemaLocalRefs, typeName)) {
          throw new Error(`Duplicate top-level type reference "${typeName}"`);
        }
        schema.topLevelJsonSchemaLocalRefs[typeName] = `#/types/${typeName}`;
      }
      for (const [serviceName, service] of Object.entries(
        definitionSource.schema.services ?? {},
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
      prepared.sources.push(schema);
    }
    return prepared;
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
    collectProtoRefs(schema.goProtoRefs, { [name]: opInOut }, "$goProtoRef");
    return { kind: "jsonSchema", name };
  }
}

function mergeSources(
  destination: MergedSources,
  source: PreparedSchema,
): void {
  for (const name of Object.keys(source.topLevelJsonSchemaTypes)) {
    if (name in destination.topLevelJsonSchemaTypes) {
      throw new Error(
        `Duplicate type "${name}" defined across multiple definition files`,
      );
    }
  }
  for (const name of Object.keys(source.services)) {
    if (name in destination.services) {
      throw new Error(
        `Duplicate service "${name}" defined across multiple definition files`,
      );
    }
  }
  for (const name of Object.keys(source.goProtoRefs)) {
    if (name in destination.goProtoRefs) {
      throw new Error(
        `Duplicate Go proto ref for type "${name}" defined across multiple definition files`,
      );
    }
  }
  Object.assign(
    destination.topLevelJsonSchemaTypes,
    source.topLevelJsonSchemaTypes,
  );
  Object.assign(destination.services, source.services);
  Object.assign(destination.goProtoRefs, source.goProtoRefs);
}

function collectProtoRefs(
  destination: { [key: string]: string },
  types: { [key: string]: any },
  fieldName: string,
): void {
  for (const [typeName, typeSchema] of Object.entries(types)) {
    if (
      typeSchema &&
      typeof typeSchema == "object" &&
      typeof (typeSchema as Record<string, unknown>)[fieldName] == "string"
    ) {
      destination[typeName] = (typeSchema as Record<string, string>)[fieldName];
    }
  }
}

class LocalFetchingSchemaStore extends JSONSchemaStore {
  async fetch(address: string): Promise<JSONSchema | undefined> {
    const content = await readFile(new URL(address), "utf8");
    return yaml.parse(content);
  }
}

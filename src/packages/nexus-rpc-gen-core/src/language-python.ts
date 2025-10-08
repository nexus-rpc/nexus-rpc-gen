import {
  ClassType,
  ConvenienceRenderer,
  Name,
  Namer,
  pythonOptions,
  PythonRenderer,
  PythonTargetLanguage,
  Type,
  type LanguageName,
  type OptionValues,
  type RenderContext,
  type RendererOptions,
  type Sourcelike,
} from "quicktype-core";
import { RenderAdapter, type RenderAccessible } from "./render-adapter.js";
import type { PreparedService, PreparedTypeReference } from "./generator.js";
import { splitDescription } from "./utility.js";
import { stringEscape } from "quicktype-core/dist/language/Java/utils.js";

// Change some defaults globally
pythonOptions.justTypes.definition.defaultValue = true;
pythonOptions.features.definition.defaultValue = "3.7";
pythonOptions.nicePropertyNames.definition.defaultValue = true;
pythonOptions.pydanticBaseModel.definition.defaultValue = true;

export class PythonLanguageWithNexus extends PythonTargetLanguage {
  protected override makeRenderer<Lang extends LanguageName = "python">(
    renderContext: RenderContext,
    untypedOptionValues: RendererOptions<Lang>,
  ): PythonRenderer {
    const adapter = new PythonRenderAdapter(
      super.makeRenderer(renderContext, untypedOptionValues),
      untypedOptionValues,
    );
    adapter.assertValidOptions();
    return adapter.makeRenderer({
      emitSourceStructure(original, givenOutputFilename) {
        // We need to add the future annotation
        // TODO(cretz): Have option to remove this?
        adapter.render.emitLine("from __future__ import annotations");
        adapter.render.ensureBlankLine();
        original(givenOutputFilename);
        adapter.render.finishFile(adapter.makeFileName());
      },
      emitClosingCode(original) {
        original();
        // Emit services _after_ all types are present. We choose to be after
        // the model types so we don't have any "ForwardRef"s to any models
        // which is not supported by Nexus Python's handler type-checking.
        adapter.emitServices();
      },
      emitClass(_original, t) {
        adapter.emitClass(t);
      },
      emitImports(original) {
        original();
        adapter.emitAdditionalImports();
      },
    });
  }
}

type PythonRenderAccessible = PythonRenderer &
  RenderAccessible & {
    readonly pyOptions: OptionValues<typeof pythonOptions>;
    declareType<T extends Type>(t: T, emitter: () => void): void;
    emitBlock(line: Sourcelike, f: () => void): void;
    emitClass(t: ClassType): void;
    emitClosingCode(): void;
    emitImports(): void;
    emitSourceStructure(givenOutputFilename: string): void;
    pythonType(t: Type, isRootTypeDef: boolean): Sourcelike;
    string(s: string): Sourcelike;
    typeHint(...sl: Sourcelike[]): Sourcelike;
    withImport(module: string, name: string): Sourcelike;
  };

const emptyNameMap: ReadonlyMap<Name, string> = new Map();

class PythonRenderAdapter extends RenderAdapter<PythonRenderAccessible> {
  private readonly typeNamer: Namer;
  private readonly propertyNamer: Namer;

  constructor(render: ConvenienceRenderer, rendererOptions: RendererOptions) {
    super(render, rendererOptions);
    this.typeNamer = this.render.makeNamedTypeNamer();
    this.propertyNamer = this.render.namerForObjectProperty();
  }

  assertValidOptions() {
    // Currently, we only support specific Python options
    if (!this.render.pyOptions.justTypes) {
      throw new Error("Python option for just-types must be set");
    }
    if (!this.render.pyOptions.pydanticBaseModel) {
      throw new Error("Python option for pydantic-model must be set");
    }
    if (!this.render.pyOptions.features.typeHints) {
      throw new Error("Python option to include type hints must be set");
    }
  }

  makeFileName() {
    // If there is a single service, use that, otherwise use the
    // filename sans extensions to build it
    const services = Object.entries(this.schema.services);
    const name =
      services.length == 1
        ? services[0][0]
        : this.nexusRendererOptions.firstFilenameSansExtensions;
    return this.propertyNamer.nameStyle(name) + ".py";
  }

  emitAdditionalImports() {
    // We have to emit imports for existing types with dots. Unlike the existing
    // withImport/emitImports, we do not want from X import Y, we want just
    // import and we will fully-qualify the types at the usage site.
    const toImport: string[] = [];
    for (const svcSchema of Object.values(this.schema.services)) {
      for (const opSchema of Object.values(svcSchema.operations)) {
        for (const type of [opSchema.input, opSchema.output]) {
          if (type?.kind == "existing") {
            const lastDot = type.name.lastIndexOf(".");
            if (
              lastDot >= 0 &&
              !toImport.includes(type.name.slice(0, lastDot))
            ) {
              toImport.push(type.name.slice(0, lastDot));
            }
          }
        }
      }
    }
    toImport.sort();
    for (const module_ of toImport) {
      this.render.emitLine("import ", module_);
    }
  }

  emitServices() {
    for (const [serviceName, serviceSchema] of Object.entries(
      this.schema.services,
    )) {
      this.emitService(serviceName, serviceSchema);
    }
  }

  emitService(serviceName: string, serviceSchema: PreparedService) {
    this.render.ensureBlankLine(2);
    const typeName = this.makeServiceTypeName(
      this.typeNamer.nameStyle(serviceName),
    );
    // Decorator
    this.render.emitLine(
      "@",
      this.render.withImport("nexusrpc", "service"),
      serviceName == typeName
        ? []
        : ["(name=", this.render.string(serviceName), ")"],
    );
    // Service class with each property
    this.render.emitBlock(["class ", typeName, ":"], () => {
      this.render.emitDescription(splitDescription(serviceSchema.description));
      if (Object.entries(serviceSchema.operations).length == 0) {
        this.render.emitLine("pass");
      }
      const propertyNamesInUse = {};
      this.render.forEachWithBlankLines(
        Object.entries(serviceSchema.operations),
        "interposing",
        (op, opName, pos) => {
          const propertyName = this.makeOperationFunctionName(
            this.propertyNamer.nameStyle(opName),
            propertyNamesInUse,
          );
          this.render.emitLine(
            propertyName,
            ": ",
            this.render.withImport("nexusrpc", "Operation"),
            "[",
            this.getNexusType(op.input) ?? "None",
            ", ",
            this.getNexusType(op.output) ?? "None",
            "]",
            opName == propertyName
              ? []
              : [
                  " = ",
                  this.render.withImport("nexusrpc", "Operation"),
                  "(name=",
                  this.render.string(opName),
                  ")",
                ],
          );
          this.render.emitDescription(splitDescription(op.description));
        },
      );
    });
  }

  emitClass(t: ClassType) {
    this.render.declareType(t, () => {
      if (t.getProperties().size === 0) {
        this.render.emitLine("pass");
        return;
      }
      this.render.forEachClassProperty(t, "none", (name, jsonName, cp) => {
        // Get the type string and append a pydantic Field to it if the name
        // doesn't match the JSON name.
        let typeSource = this.render.pythonType(cp.type, true);
        // const fieldName = name.namingFunction.nameStyle(name.firstProposedName(emptyNameMap));
        const fieldName = this.render.sourcelikeToString(name);
        if (fieldName != jsonName) {
          // Ellipsis means no default. In optional situations, typeSource has a
          // trailing " = None" which we need to remove and set as default
          let fieldDefault = "...";
          if (Array.isArray(typeSource) && typeSource.at(-1) == " = None") {
            typeSource = typeSource.slice(0, -1);
            fieldDefault = "None";
          }
          typeSource = [
            typeSource,
            " = ",
            this.render.withImport("pydantic", "Field"),
            "(",
            fieldDefault,
            ", serialization_alias=",
            this.render.string(jsonName),
            ")",
          ];
        }
        this.render.emitLine(name, ": ", typeSource);
        this.render.emitDescription(
          this.render.descriptionForClassProperty(t, jsonName),
        );
      });
      this.render.ensureBlankLine();
    });
  }

  getNexusType(
    reference: PreparedTypeReference | undefined,
  ): Sourcelike | undefined {
    if (!reference) {
      return undefined;
    } else if (reference.kind == "existing") {
      return reference.name;
    } else {
      const type = this.render.topLevels.get(reference.name);
      if (!type) {
        throw new Error(`Unable to find type for ${reference.name}`);
      }
      return this.render.pythonType(type, false);
    }
  }
}

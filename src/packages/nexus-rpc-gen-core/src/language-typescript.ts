import {
  ClassType,
  Name,
  tsFlowOptions,
  Type,
  TypeScriptRenderer,
  TypeScriptTargetLanguage,
  type LanguageName,
  type MultiWord,
  type RenderContext,
  type RendererOptions,
  type Sourcelike,
} from "quicktype-core";
import { RenderAdapter, type RenderAccessible } from "./render-adapter.js";
import type { PreparedService, PreparedTypeReference } from "./generator.js";
import { splitDescription } from "./utility.js";
import { utf16StringEscape } from "quicktype-core/dist/support/Strings.js";

// Change some defaults globally
tsFlowOptions.justTypes.definition.defaultValue = true;

export class TypeScriptLanguageWithNexus extends TypeScriptTargetLanguage {
  protected override makeRenderer<Lang extends LanguageName = "typescript">(
    renderContext: RenderContext,
    untypedOptionValues: RendererOptions<Lang>,
  ): TypeScriptRenderer {
    const adapter = new TypeScriptRenderAdapter(
      super.makeRenderer(renderContext, untypedOptionValues),
      untypedOptionValues,
    );
    return adapter.makeRenderer({
      emitSourceStructure(original) {
        adapter.emitServices();
        original();
        adapter.render.finishFile(adapter.makeFileName());
      },
      emitTypes(original) {
        // We cannot use original emitTypes, see override for reason why
        adapter.emitTypes();
      },
    });
  }
}

type TypeScriptRenderAccessible = TypeScriptRenderer &
  RenderAccessible & {
    emitBlock(source: Sourcelike, end: Sourcelike, emit: () => void): void;
    emitSourceStructure(): void;
    emitTypes(): void;
    nameStyle(original: string, upper: boolean): string;
    sourceFor(t: Type): MultiWord;
  };

interface ExistingType {
  type: string;
  from?: string;
  alias?: string;
}

class TypeScriptRenderAdapter extends RenderAdapter<TypeScriptRenderAccessible> {
  private _existingTypes?: Record<string, ExistingType>;

  makeFileName() {
    // If there is a single service, use that, otherwise use the
    // filename sans extensions to build it
    const services = Object.entries(this.schema.services);
    if (services.length == 1) {
      return `${services[0][0]}.ts`;
    }
    return `${this.nexusRendererOptions.firstFilenameSansExtensions}.ts`;
  }

  // Key is full string as given in schema
  get existingTypes(): Record<string, ExistingType> {
    if (this._existingTypes === undefined) {
      this._existingTypes = {};
      const inUse = {};
      for (const serviceSchema of Object.values(this.schema.services)) {
        for (const opSchema of Object.values(serviceSchema.operations)) {
          for (const type of [opSchema.input, opSchema.output]) {
            if (type?.kind == "existing") {
              // TODO(cretz): Generics with qualified type args that need to be imported?
              const lastHash = type.name.lastIndexOf("#");
              const existingType: ExistingType = {
                type: type.name.slice(lastHash + 1),
                from: lastHash == -1 ? undefined : type.name.slice(0, lastHash),
              };
              // Alias it while it already exists
              let alias = existingType.type;
              for (
                let index = 1;
                Object.hasOwn(inUse, alias) ||
                this.topLevelNameInUse(alias, true);
                index++
              ) {
                alias = `${existingType.type}${index}`;
              }
              if (alias != existingType.type) {
                existingType.alias = alias;
              }
              this._existingTypes[type.name] = existingType;
            }
          }
        }
      }
    }
    return this._existingTypes;
  }

  emitServices() {
    // If there are no services, do nothing
    if (Object.entries(this.schema.services).length == 0) {
      return;
    }

    // Import Nexus
    this.render.emitLine('import * as nexus from "nexus-rpc";');

    // Import all "existing" types
    const existingTypesByFrom: Record<string, ExistingType[]> = {};
    for (const existingType of Object.values(this.existingTypes)) {
      if (existingType.from) {
        if (!Object.hasOwn(existingTypesByFrom, existingType.from)) {
          existingTypesByFrom[existingType.from] = [];
        }
        existingTypesByFrom[existingType.from].push(existingType);
      }
    }
    // TODO(cretz): Better sorting?
    for (const [from, existingTypes] of Object.entries(
      existingTypesByFrom,
    ).toSorted((a, b) => a[0].localeCompare(b[0]))) {
      existingTypes.sort((a, b) => a.type.localeCompare(b.type));
      const pieces = existingTypes.map((t) => {
        let piece = `type ${t.type}`;
        if (t.alias) piece += ` as ${t.alias}`;
        return piece;
      });
      this.render.emitLine(
        "import { ",
        pieces.join(", "),
        ' } from "',
        utf16StringEscape(from),
        '";',
      );
    }

    // Emit each service
    for (const [serviceName, serviceSchema] of Object.entries(
      this.schema.services,
    )) {
      this.emitService(serviceName, serviceSchema);
    }
  }

  emitService(serviceName: string, serviceSchema: PreparedService) {
    this.render.ensureBlankLine();
    const constName = this.makeServiceTypeName(
      this.render.nameStyle(serviceName, false),
    );

    this.render.emitDescription(splitDescription(serviceSchema.description));
    this.render.emitBlock(
      [
        "export const ",
        constName,
        ' = nexus.service("',
        utf16StringEscape(serviceName),
        '", ',
      ],
      ");",
      () => {
        const propertyNamesInUse = {};
        this.render.forEachWithBlankLines(
          Object.entries(serviceSchema.operations),
          "interposing",
          (op, opName, pos) => {
            this.render.emitDescription(splitDescription(op.description));
            const propertyName = this.makeOperationFunctionName(
              this.render.nameStyle(opName, false),
              propertyNamesInUse,
            );
            const opArguments =
              opName == propertyName
                ? []
                : ['{ name: "', utf16StringEscape(opName), '" }'];
            this.render.emitLine(
              propertyName,
              ": nexus.operation<",
              this.getNexusType(op.input) ?? "void",
              ", ",
              this.getNexusType(op.output) ?? "void",
              ">(",
              opArguments,
              "),",
            );
          },
        );
      },
    );
  }

  emitTypes() {
    // We cannot use original emitTypes because it renders all top level types
    // as non-export and includes __ALL_TYPES__, but we want export and don't
    // want that pseudo type. So we copy what Quicktype did mostly, with some
    // alterations.

    // Primitives
    this.render.forEachWithBlankLines(
      this.render.topLevels,
      "none",
      (t, name, pos) => {
        if (!t.isPrimitive() || name == "__ALL_TYPES__") {
          return;
        }

        this.render.ensureBlankLine();
        this.render.emitDescription(this.render.descriptionForType(t));
        this.render.emitLine(
          "export type ",
          name,
          " = ",
          this.render.sourceFor(t).source,
          ";",
        );
      },
    );

    // Named types
    this.render.forEachNamedType(
      "leading-and-interposing",
      (c: ClassType, n: Name) => (this.render as any).emitClass(c, n),
      (enm, n) => (this.render as any).emitEnum(enm, n),
      (u, n) => (this.render as any).emitUnion(u, n),
    );
  }

  exportTopLevelPrimitives() {
    // TypeScript rendered by default does not export primitive type aliases, so
    // we must. First, collect set to export
    const toExport = Object.keys(this.schema.topLevelJsonSchemaTypes).filter(
      (name) => this.render.topLevels.get(name)?.isPrimitive(),
    );
    // Render if any
    if (toExport.length > 0) {
      this.render.ensureBlankLine();
      this.render.emitLine("export { ", toExport.join(", "), " };");
    }
  }

  getNexusType(
    reference: PreparedTypeReference | undefined,
  ): Sourcelike | undefined {
    if (!reference) {
      return undefined;
    } else if (reference.kind == "existing") {
      const type = this.existingTypes[reference.name];
      return type.alias ?? type.type;
    } else {
      const type = this.render.topLevels.get(reference.name);
      if (!type) {
        throw new Error(`Unable to find type for ${reference.name}`);
      }

      // If the type is primitive, use the alias
      if (type.isPrimitive()) {
        return reference.name;
      }

      return this.render.sourceFor(type).source;
    }
  }

  opNameForbidden(name: string): boolean {
    // We also want to forbid any Object functions
    return super.opNameForbidden(name) || name in {};
  }
}

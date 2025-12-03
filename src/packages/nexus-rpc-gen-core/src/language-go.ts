import {
  ConvenienceRenderer,
  goOptions,
  GoRenderer,
  GoTargetLanguage,
  Name,
  Namer,
  Type,
  type LanguageName,
  type OptionValues,
  type RenderContext,
  type RendererOptions,
  type Sourcelike,
} from "quicktype-core";
import { splitDescription } from "./utility.js";
import {
  type PreparedService,
  type PreparedTypeReference,
} from "./generator.js";
import { RenderAdapter, type RenderAccessible } from "./render-adapter.js";
import { stringEscape } from "quicktype-core/dist/support/Strings.js";
import {
  BooleanOption,
  getOptionValues,
} from "quicktype-core/dist/RendererOptions/index.js";
import { primitiveValueTypeKinds } from "quicktype-core/dist/language/Golang/utils.js";

// Add options
export const goWithNexusOptions = {
  primitivePointers: new BooleanOption(
    "primitive-pointers",
    "Use pointers for nullable primitives",
    false,
  ),
  ...goOptions,
};

// Change some defaults globally
goWithNexusOptions.justTypesAndPackage.definition.defaultValue = true;

export class GoLanguageWithNexus extends GoTargetLanguage {
  override getOptions(): typeof goWithNexusOptions {
    return goWithNexusOptions;
  }

  protected override makeRenderer<Lang extends LanguageName = "go">(
    renderContext: RenderContext,
    untypedOptionValues: RendererOptions<Lang>,
  ): GoRenderer {
    const adapter = new GoRenderAdapter(
      super.makeRenderer(renderContext, untypedOptionValues),
      untypedOptionValues,
    );
    adapter.assertValidOptions();

    const options = getOptionValues(goWithNexusOptions, untypedOptionValues);

    return adapter.makeRenderer({
      emitSourceStructure(original) {
        adapter.emitServices();
        original();
        adapter.render.finishFile(adapter.makeFileName());
      },
      emitTopLevel(original, t, name) {
        // Do not emit __ALL_TYPES__ placeholder
        if (name.firstProposedName(new Map()) == "__ALL_TYPES__") {
          return;
        }
        original(t, name);
      },
      nullableGoType(original, t, withIssues) {
        // If the kind is a primitive and primitive pointers disabled, just return goType
        if (
          !options.primitivePointers &&
          primitiveValueTypeKinds.includes(t.kind)
        ) {
          return adapter.render.goType(t, withIssues);
        }
        return original(t, withIssues);
      },
    });
  }
}

type GoRenderAccessible = Omit<GoRenderer, "emitTypesAndSupport"> &
  RenderAccessible & {
    readonly _options: OptionValues<typeof goOptions>;
    get haveNamedUnions(): boolean;
    collectAllImports(): Set<string>;
    emitSourceStructure(): void;
    emitTopLevel(t: Type, name: Name): void;
    goType(t: Type, withIssues?: boolean): Sourcelike;
    namerForObjectProperty(): Namer;
    nullableGoType(t: Type, withIssues: boolean): Sourcelike;
  };

class GoRenderAdapter extends RenderAdapter<GoRenderAccessible> {
  private _imports?: Record<string, string>;

  assertValidOptions() {
    // Currently, we only support single-file in Go
    if (this.render._options.multiFileOutput) {
      throw new Error("Multi-file output for Go not supported at this time");
    }
  }

  makeFileName() {
    // If there is a single service, use that, otherwise use the
    // filename sans extensions to build it
    const services = Object.entries(this.schema.services);
    const name =
      services.length == 1
        ? `${services[0][0]}.go`
        : `${this.nexusRendererOptions.firstFilenameSansExtensions}.go`;
    return name.toLowerCase();
  }

  // Key is qualified import, value is alias
  get imports(): Record<string, string> {
    if (this._imports === undefined) {
      this._imports = {};

      // Quicktype does not have a sophisticated import+alias construct for its
      // renderer because they only ever needed one import. However, since we allow
      // external types, we must support proper aliasing.
      const origImports = this.render.collectAllImports();
      if (
        !this.render._options.justTypes &&
        !this.render._options.justTypesAndPackage
      ) {
        if (
          this.render.haveNamedUnions &&
          !this.render._options.multiFileOutput
        ) {
          origImports.add("bytes");
          origImports.add("errors");
        }
        origImports.add("encoding/json");
      }
      origImports.add("github.com/nexus-rpc/sdk-go/nexus");
      for (const mport of origImports) {
        this._imports[mport] = mport.split("/").pop()!;
      }

      // Add any external type reference pre-last-dots as imports
      // TODO(cretz): Generics with qualified type args that need to be imported?
      const externalTypes = Object.values(this.schema.services).flatMap((svc) =>
        Object.values(svc.operations).flatMap((op) => [
          op?.input?.kind == "existing" ? op.input.name : null,
          op?.output?.kind == "existing" ? op.output.name : null,
        ]),
      );
      for (const externalType of externalTypes) {
        const lastDot = externalType?.lastIndexOf(".") ?? -1;
        if (externalType && lastDot > 0) {
          const mport = externalType.slice(0, lastDot);
          if (!Object.hasOwn(this._imports, mport)) {
            // Append number until an unused alias is found
            const origAlias = mport.split("/").pop()!;
            let alias = origAlias;
            let number_ = 0;
            while (Object.values(this._imports).includes(alias)) {
              alias = `${origAlias}${++number_}`;
            }
            this._imports[mport] = alias;
          }
        }
      }
    }
    return this._imports;
  }

  emitServices() {
    // Package decl
    if (
      !this.render._options.justTypes ||
      this.render._options.justTypesAndPackage
    ) {
      this.render.ensureBlankLine();
      const packageDeclaration = `package ${this.render._options.packageName}`;
      this.render.emitLineOnce(packageDeclaration);
      this.render.ensureBlankLine();
    }

    // Emit imports. To match goimports, we do all non-dot sorted, followed by blank line,
    // then all dotted, sorted
    const imports = Object.entries(this.imports).toSorted(
      ([mportA, _a], [mportB, _b]) => mportA.localeCompare(mportB),
    );
    for (const [mport, alias] of imports.filter(
      ([mport, _]) => !mport.includes("."),
    )) {
      const aliasPiece = alias != mport.split("/").pop()! ? `${alias} ` : "";
      // Must be a single string so it caches the full line for "once" so the
      // Quicktype renderer doesn't render its own forms
      this.render.emitLineOnce(`import ${aliasPiece}"${mport}"`);
    }
    this.render.ensureBlankLine();
    for (const [mport, alias] of imports.filter(([mport, _]) =>
      mport.includes("."),
    )) {
      const aliasPiece = alias != mport.split("/").pop()! ? `${alias} ` : "";
      this.render.emitLineOnce(`import ${aliasPiece}"${mport}"`);
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

    const variableName = this.makeServiceTypeName(
      this.render.makeNamedTypeNamer().nameStyle(serviceName),
    );

    // Collect operations
    const fieldNamesInUse = {};
    const operations: {
      descPieces: string[];
      opName: string;
      fieldName: string;
      inType: Sourcelike;
      outType: Sourcelike;
    }[] = Object.entries(serviceSchema.operations).flatMap(
      ([opName, opSchema]) => ({
        descPieces: splitDescription(opSchema.description) ?? [],
        opName,
        fieldName: this.makeOperationFunctionName(
          this.render.namerForObjectProperty().nameStyle(opName),
          fieldNamesInUse,
        ),
        inType: this.getNexusType(opSchema.input) ?? "nexus.NoValue",
        outType: this.getNexusType(opSchema.output) ?? "nexus.NoValue",
      }),
    );

    // Create var with anonymous struct
    this.render.emitDescription(splitDescription(serviceSchema.description));
    this.render.emitLine("var ", variableName, " = struct {");
    this.render.indent(() => {
      this.render.emitTable([
        [["ServiceName", " "], ["string"]],
        ...operations.flatMap((op) => {
          const pieces = [];
          if (op.descPieces.length > 0) {
            pieces.push([op.descPieces.map((d) => `// ${d}`)]);
          }
          pieces.push([
            [op.fieldName, " "],
            ["nexus.OperationReference[", op.inType, ", ", op.outType, "]"],
          ]);
          return pieces;
        }),
      ]);
    });
    this.render.emitLine("}{");
    this.render.indent(() => {
      this.render.emitTable([
        [["ServiceName:", " "], [`"${stringEscape(serviceName)}",`]],
        ...operations.map((op) => [
          [op.fieldName + ":", " "],
          [
            "nexus.NewOperationReference[",
            op.inType,
            ", ",
            op.outType,
            `]("${stringEscape(op.opName)}"),`,
          ],
        ]),
      ]);
    });
    this.render.emitLine("}");
  }

  getNexusType(
    reference: PreparedTypeReference | undefined,
  ): Sourcelike | undefined {
    if (!reference) {
      return undefined;
    } else if (reference.kind == "existing") {
      // If there is a dot, need to take qualified package and get alias
      const lastDot = reference.name.lastIndexOf(".");
      if (lastDot > 0) {
        const mport = reference.name.slice(0, lastDot);
        return `${this.imports[mport]}.${reference.name.slice(lastDot + 1)}`;
      }
      return reference.name;
    } else {
      const type = this.render.topLevels.get(reference.name);
      if (!type) {
        throw new Error(`Unable to find type for ${reference.name}`);
      }

      // If the type is primitive, use the alias
      if (type.isPrimitive()) {
        return reference.name;
      }

      return this.render.goType(type);
    }
  }
}

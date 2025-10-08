import {
  javaOptions,
  JavaRenderer,
  JavaTargetLanguage,
  Namer,
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
javaOptions.packageName.definition.defaultValue = "com.example.nexusservices";

export class JavaLanguageWithNexus extends JavaTargetLanguage {
  protected override get defaultIndentation(): string {
    // We want two-space indent to be default for Java
    return "  ";
  }

  protected override makeRenderer<Lang extends LanguageName = "java">(
    renderContext: RenderContext,
    untypedOptionValues: RendererOptions<Lang>,
  ): JavaRenderer {
    const adapter = new JavaRenderAdapter(
      super.makeRenderer(renderContext, untypedOptionValues),
      untypedOptionValues,
    );
    return adapter.makeRenderer({
      emitSourceStructure(original) {
        adapter.emitServices();
        original();
      },
      emitConverterClass(original) {
        // No converter class wanted
      },
      forbiddenNamesForGlobalNamespace(original) {
        const returnValue = original();
        // We need to adjust some forbidden names to include Object base class items
        returnValue.push(
          "clone",
          "equals",
          "finalize",
          "getClass",
          "hashCode",
          "notify",
          "notifyAll",
          "toString",
          "wait",
        );
        return returnValue;
      },
      startFile(original, basename) {
        // Prepend a the package name for Java
        const prepend =
          adapter.render._options.packageName.replaceAll(".", "/") + "/";
        original([prepend, basename]);
      },
    });
  }
}

type JavaRenderAccessible = JavaRenderer &
  RenderAccessible & {
    readonly _options: OptionValues<typeof javaOptions>;
    emitBlock(line: Sourcelike, f: () => void): void;
    emitConverterClass(): void;
    emitFileHeader(fileName: Sourcelike, imports: string[]): void;
    emitSourceStructure(): void;
    finishFile(): void;
    forbiddenNamesForGlobalNamespace(): string[];
    javaImport(t: Type): string[];
    javaType(reference: boolean, t: Type, withIssues?: boolean): Sourcelike;
    makeNamedTypeNamer(): Namer;
    namerForObjectProperty(): Namer;
    startFile(basename: Sourcelike): void;
  };

class JavaRenderAdapter extends RenderAdapter<JavaRenderAccessible> {
  emitServices() {
    for (const [serviceName, serviceSchema] of Object.entries(
      this.schema.services,
    )) {
      this.emitService(serviceName, serviceSchema);
    }
  }

  emitService(serviceName: string, serviceSchema: PreparedService) {
    // Collect imports
    const imports: string[] = ["io.nexusrpc.Operation", "io.nexusrpc.Service"];
    for (const [_, op] of Object.entries(serviceSchema.operations)) {
      if (op.input?.kind == "jsonSchema") {
        const type = this.render.topLevels.get(op.input.name);
        if (type) {
          imports.push(...this.render.javaImport(type));
        }
      }
      if (op.output?.kind == "jsonSchema") {
        const type = this.render.topLevels.get(op.output.name);
        if (type) {
          imports.push(...this.render.javaImport(type));
        }
      }
    }

    // Create class
    // TODO(cretz): Research addNameForTopLevel and such to prevent service name clash
    const className = this.makeServiceTypeName(
      this.render.makeNamedTypeNamer().nameStyle(serviceName),
    );
    const packagePrepend =
      this.render._options.packageName.replaceAll(".", "/") + "/";
    this.render.emitFileHeader([packagePrepend, className], imports);
    this.render.emitDescription(splitDescription(serviceSchema.description));
    this.render.emitLine(
      "@Service",
      className == serviceName
        ? []
        : ['(name="', stringEscape(serviceName), '")'],
    );
    const methodNamesInUse = {};
    this.render.emitBlock(["public interface ", className], () => {
      this.render.forEachWithBlankLines(
        Object.entries(serviceSchema.operations),
        "interposing",
        (op, opName, pos) => {
          this.render.emitDescription(splitDescription(op.description));
          const methodName = this.makeOperationFunctionName(
            this.render.namerForObjectProperty().nameStyle(opName),
            methodNamesInUse,
          );
          this.render.emitLine(
            "@Operation",
            methodName == opName ? [] : ['(name="', stringEscape(opName), '")'],
          );
          const inType = this.getNexusType(op.input);
          this.render.emitLine(
            this.getNexusType(op.output) ?? "void",
            " ",
            methodName,
            "(",
            inType ? [inType, " input"] : [],
            ");",
          );
        },
      );
    });
    this.render.finishFile();
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
      return this.render.javaType(false, type);
    }
  }
}

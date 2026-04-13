import {
  ArrayType,
  ClassType,
  ConvenienceRenderer,
  goOptions,
  GoRenderer,
  GoTargetLanguage,
  MapType,
  Name,
  Namer,
  Type,
  UnionType,
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
        adapter.emitTemporalNexusPayloadSupport();
        adapter.emitTemporalNexusPayloadRegistry();
        adapter.render.finishFile(adapter.makeFileName());
      },
      emitTopLevel(original, t, name) {
        // Do not emit __ALL_TYPES__ placeholder
        if (name.firstProposedName(new Map()).endsWith("/__ALL_TYPES__")) {
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

// Go convention: a path component matching /^v\d+$/ is a major version suffix
// (e.g. "v1", "v2"). The actual package name is the preceding component, so Go
// will resolve the identifier from the package declaration rather than the path.
// For versioned paths, combine the parent component and version (e.g.
// ".../workflowservice/v1" → "workflowservicev1") so the alias is both unambiguous
// and self-documenting. An explicit alias is required to override Go's default.
function aliasForImport(mport: string): string {
  const parts = mport.split("/");
  const last = parts[parts.length - 1];
  if (/^v\d+$/.test(last) && parts.length >= 2) {
    return `${parts[parts.length - 2]}${last}`;
  }
  return last;
}

function needsExplicitAlias(mport: string, alias: string): boolean {
  return alias !== mport.split("/").pop()!;
}

type GoRenderAccessible = Omit<GoRenderer, "emitTypesAndSupport"> &
  RenderAccessible & {
    readonly _options: OptionValues<typeof goOptions>;
    emitBlock(line: Sourcelike, f: () => void): void;
    get haveNamedUnions(): boolean;
    collectAllImports(): Set<string>;
    emitSourceStructure(): void;
    emitTopLevel(t: Type, name: Name): void;
    goType(t: Type, withIssues?: boolean): Sourcelike;
    namerForObjectProperty(): Namer;
    nullableGoType(t: Type, withIssues: boolean): Sourcelike;
  };

type TemporalTerminalRewriteKind = "payload" | "payloads";

type TemporalPayloadMapRewriteKind = "headerFields" | "memoFields" | "searchAttributes";

type TemporalFieldRewrite =
  | {
      kind: "payload";
      jsonName: string;
    }
  | {
      kind: "payloadMap";
      jsonName: string;
      mapKind: TemporalPayloadMapRewriteKind;
    }
  | {
      kind: "payloads";
      jsonName: string;
    }
  | {
      kind: "object";
      jsonName: string;
      helperName: string;
    }
  | {
      kind: "array";
      jsonName: string;
      helperName: string;
    }
  | {
      kind: "map";
      jsonName: string;
      helperName: string;
    };

interface TemporalClassRewritePlan {
  typeName: string;
  helperName: string;
  directRewriteKind?: TemporalTerminalRewriteKind;
  onlyWhenVisitSearchAttributes?: boolean;
  fieldRewrites: TemporalFieldRewrite[];
}

interface TemporalOperationPayloadVisitor {
  serviceName: string;
  operationName: string;
  inputTypeName: string;
  helperName: string;
}

class GoRenderAdapter extends RenderAdapter<GoRenderAccessible> {
  private _imports?: Record<string, string>;
  private temporalClassRewritePlans:
    | Map<string, TemporalClassRewritePlan>
    | undefined;
  private temporalClassRewritePlanInProgress:
    | Set<string>
    | undefined;
  private nexusPayloadVisitors:
    | readonly TemporalOperationPayloadVisitor[]
    | undefined;

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

  makeTemporalClassRewriteHelperName(typeName: string) {
    return `rewrite${typeName}JSON`;
  }

  makeTemporalNexusRewriterFunctionName(typeName: string) {
    return `rewrite${typeName}Payload`;
  }

  renderStringLiteral(value: string): Sourcelike {
    return [`"${stringEscape(value)}"`];
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
      if (
        this.nexusRendererOptions.temporalNexusPayloadCodecSupport &&
        this.getNexusPayloadVisitors().length > 0
      ) {
        origImports.add("encoding/json");
        origImports.add("errors");
        origImports.add("go.temporal.io/api/common/v1");
        origImports.add("go.temporal.io/api/temporalproto");
        origImports.add("google.golang.org/protobuf/proto");
      }
      for (const mport of origImports) {
        this._imports[mport] = aliasForImport(mport);
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
            const origAlias = aliasForImport(mport);
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
      this.render.emitLineOnce(
        "// Code generated by nexus-rpc-gen. DO NOT EDIT.",
      );
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
      const aliasPiece = needsExplicitAlias(mport, alias) ? `${alias} ` : "";
      // Must be a single string so it caches the full line for "once" so the
      // Quicktype renderer doesn't render its own forms
      this.render.emitLineOnce(`import ${aliasPiece}"${mport}"`);
    }
    this.render.ensureBlankLine();
    for (const [mport, alias] of imports.filter(([mport, _]) =>
      mport.includes("."),
    )) {
      const aliasPiece = needsExplicitAlias(mport, alias) ? `${alias} ` : "";
      this.render.emitLineOnce(`import ${aliasPiece}"${mport}"`);
    }

    // Emit each service
    for (const [serviceName, serviceSchema] of Object.entries(
      this.schema.services,
    )) {
      this.emitService(serviceName, serviceSchema);
    }
  }

  emitTemporalNexusPayloadSupport() {
    if (
      !this.nexusRendererOptions.temporalNexusPayloadCodecSupport ||
      this.getNexusPayloadVisitors().length == 0
    ) {
      return;
    }

    const commonv1 = this.imports["go.temporal.io/api/common/v1"];
    const temporalproto = this.imports["go.temporal.io/api/temporalproto"];
    const proto = this.imports["google.golang.org/protobuf/proto"];

    this.render.ensureBlankLine(2);
    this.render.emitLine(
      "type TemporalNexusPayloadVisitorFunc func([]*",
      commonv1,
      ".Payload) ([]*",
      commonv1,
      ".Payload, error)",
    );
    this.render.ensureBlankLine();
    this.render.emitLine(
      "type TemporalNexusPayloadVisitor func(*",
      commonv1,
      ".Payload, TemporalNexusPayloadVisitorFunc, bool) (*",
      commonv1,
      ".Payload, error)",
    );
    this.render.ensureBlankLine();
    this.render.emitBlock("type TemporalNexusPayloadVisitorKey struct", () => {
      this.render.emitLine("ServiceName string");
      this.render.emitLine("OperationName string");
    });
    this.render.ensureBlankLine();
    this.render.emitBlock("type temporalNexusPayloadVisitor struct", () => {
      this.render.emitLine("payloadVisitor TemporalNexusPayloadVisitorFunc");
      this.render.emitLine("visitSearchAttributes bool");
    });
    this.render.ensureBlankLine();
    this.render.emitLine(
      "var temporalNexusPayloadShorthandMetadata = map[string]interface{}{",
    );
    this.render.indent(() => {
      this.render.emitLine(commonv1, ".EnablePayloadShorthandMetadataKey: true,");
    });
    this.render.emitLine("}");
    this.render.ensureBlankLine();
    this.render.emitBlock(
      [
        "func temporalNexusDecodeJSONValue(",
        "value any, message ",
        proto,
        ".Message",
        ") error",
      ],
      () => {
        this.render.emitLine("data, err := json.Marshal(value)");
        this.render.emitLine("if err != nil {");
        this.render.indent(() => this.render.emitLine("return err"));
        this.render.emitLine("}");
        this.render.emitLine(
          "return ",
          temporalproto,
          ".CustomJSONUnmarshalOptions{Metadata: temporalNexusPayloadShorthandMetadata}.Unmarshal(data, message)",
        );
      },
    );
    this.render.ensureBlankLine();
    this.render.emitBlock(
      [
        "func temporalNexusEncodeJSONValue(",
        "message ",
        proto,
        ".Message",
        ") (any, error)",
      ],
      () => {
        this.render.emitLine(
          "data, err := ",
          temporalproto,
          ".CustomJSONMarshalOptions{Metadata: temporalNexusPayloadShorthandMetadata}.Marshal(message)",
        );
        this.render.emitLine("if err != nil {");
        this.render.indent(() => this.render.emitLine("return nil, err"));
        this.render.emitLine("}");
        this.render.emitLine("var value any");
        this.render.emitLine("if err := json.Unmarshal(data, &value); err != nil {");
        this.render.indent(() => this.render.emitLine("return nil, err"));
        this.render.emitLine("}");
        this.render.emitLine("return value, nil");
      },
    );
    this.render.ensureBlankLine();
    this.render.emitBlock(
      [
        "func (r *temporalNexusPayloadVisitor) rewritePayloadJSON(",
        "value any",
        ") (any, error)",
      ],
      () => {
        this.render.emitLine("payload := &", commonv1, ".Payload{}");
        this.render.emitLine(
          "if err := temporalNexusDecodeJSONValue(value, payload); err != nil {",
        );
        this.render.indent(() => this.render.emitLine("return nil, err"));
        this.render.emitLine("}");
        this.render.emitLine(
          "rewrittenPayloads, err := r.payloadVisitor([]*",
          commonv1,
          ".Payload{payload})",
        );
        this.render.emitLine("if err != nil {");
        this.render.indent(() => this.render.emitLine("return nil, err"));
        this.render.emitLine("}");
        this.render.emitLine("if len(rewrittenPayloads) != 1 {");
        this.render.indent(() =>
          this.render.emitLine(
            'return nil, errors.New("temporal nexus payload visitor returned unexpected payload count")',
          ),
        );
        this.render.emitLine("}");
        this.render.emitLine(
          "return temporalNexusEncodeJSONValue(rewrittenPayloads[0])",
        );
      },
    );
    this.render.ensureBlankLine();
    this.render.emitBlock(
      [
        "func (r *temporalNexusPayloadVisitor) rewritePayloadsJSON(",
        "value any",
        ") (any, error)",
      ],
      () => {
        this.render.emitLine("payloads := &", commonv1, ".Payloads{}");
        this.render.emitLine(
          "if err := temporalNexusDecodeJSONValue(value, payloads); err != nil {",
        );
        this.render.indent(() => this.render.emitLine("return nil, err"));
        this.render.emitLine("}");
        this.render.emitLine(
          "rewrittenPayloads, err := r.payloadVisitor(payloads.Payloads)",
        );
        this.render.emitLine("if err != nil {");
        this.render.indent(() => this.render.emitLine("return nil, err"));
        this.render.emitLine("}");
        this.render.emitLine("payloads.Payloads = rewrittenPayloads");
        this.render.emitLine("return temporalNexusEncodeJSONValue(payloads)");
      },
    );
    this.render.ensureBlankLine();
    for (const [helperName, messageType, fieldName, needsFlag] of [
      ["rewriteHeaderFieldsJSON", `${commonv1}.Header`, "fields", false],
      ["rewriteMemoFieldsJSON", `${commonv1}.Memo`, "fields", false],
      [
        "rewriteSearchAttributesFieldsJSON",
        `${commonv1}.SearchAttributes`,
        "indexedFields",
        true,
      ],
    ] as const) {
      this.render.emitBlock(
        [
          "func (r *temporalNexusPayloadVisitor) ",
          helperName,
          "(value any) (any, error)",
        ],
        () => {
          if (needsFlag) {
            this.render.emitLine("if !r.visitSearchAttributes {");
            this.render.indent(() => this.render.emitLine("return value, nil"));
            this.render.emitLine("}");
          }
          this.render.emitLine(
            "messageValue := map[string]any{",
            this.renderStringLiteral(fieldName),
            ": value}",
          );
          this.render.emitLine("message := &", messageType, "{}");
          this.render.emitLine(
            "if err := temporalNexusDecodeJSONValue(messageValue, message); err != nil {",
          );
          this.render.indent(() => this.render.emitLine("return nil, err"));
          this.render.emitLine("}");
          this.render.emitLine(
            "keys := make([]string, 0, len(message.",
            fieldName == "indexedFields" ? "IndexedFields" : "Fields",
            "))",
          );
          this.render.emitLine(
            "payloads := make([]*",
            commonv1,
            ".Payload, 0, len(message.",
            fieldName == "indexedFields" ? "IndexedFields" : "Fields",
            "))",
          );
          this.render.emitBlock(
            [
              "for key, payload := range message.",
            fieldName == "indexedFields" ? "IndexedFields" : "Fields",
          ],
            () => {
              this.render.emitLine("keys = append(keys, key)");
              this.render.emitLine("payloads = append(payloads, payload)");
            },
          );
          this.render.emitLine(
            "rewrittenPayloads, err := r.payloadVisitor(payloads)",
          );
          this.render.emitLine("if err != nil {");
          this.render.indent(() => this.render.emitLine("return nil, err"));
          this.render.emitLine("}");
          this.render.emitLine("if len(rewrittenPayloads) != len(keys) {");
          this.render.indent(() =>
            this.render.emitLine(
              'return nil, errors.New("temporal nexus payload visitor returned unexpected payload count")',
            ),
          );
          this.render.emitLine("}");
          this.render.emitLine(
            "message.",
            fieldName == "indexedFields" ? "IndexedFields" : "Fields",
            " = make(map[string]*",
            commonv1,
            ".Payload, len(keys))",
          );
          this.render.emitBlock("for i, key := range keys", () => {
            this.render.emitLine(
              "message.",
              fieldName == "indexedFields" ? "IndexedFields" : "Fields",
              "[key] = rewrittenPayloads[i]",
            );
          });
          this.render.emitLine("encoded, err := temporalNexusEncodeJSONValue(message)");
          this.render.emitLine("if err != nil {");
          this.render.indent(() => this.render.emitLine("return nil, err"));
          this.render.emitLine("}");
          this.render.emitLine("encodedMap, ok := encoded.(map[string]any)");
          this.render.emitLine("if !ok {");
          this.render.indent(() =>
            this.render.emitLine(
              'return nil, errors.New("temporal nexus payload visitor expected object JSON")',
            ),
          );
          this.render.emitLine("}");
          this.render.emitLine(
            "return encodedMap[",
            this.renderStringLiteral(fieldName),
            "], nil",
          );
        },
      );
      this.render.ensureBlankLine();
    }
    for (const plan of this.getTemporalClassRewritePlans().values()) {
      this.emitTemporalClassRewritePlan(plan);
      this.render.ensureBlankLine();
    }
  }

  emitTemporalClassRewritePlan(plan: TemporalClassRewritePlan) {
    this.render.emitBlock(
      [
        "func (r *temporalNexusPayloadVisitor) ",
        plan.helperName,
        "(value map[string]any) (map[string]any, error)",
      ],
      () => {
        if (plan.onlyWhenVisitSearchAttributes) {
          this.render.emitLine("if !r.visitSearchAttributes {");
          this.render.indent(() => this.render.emitLine("return value, nil"));
          this.render.emitLine("}");
        }
        if (plan.directRewriteKind == "payload") {
          this.render.emitLine("rewritten, err := r.rewritePayloadJSON(value)");
          this.render.emitLine("if err != nil {");
          this.render.indent(() => this.render.emitLine("return nil, err"));
          this.render.emitLine("}");
          this.render.emitLine("rewrittenMap, ok := rewritten.(map[string]any)");
          this.render.emitLine("if !ok {");
          this.render.indent(() =>
            this.render.emitLine(
              'return nil, errors.New("temporal nexus payload visitor expected object JSON")',
            ),
          );
          this.render.emitLine("}");
          this.render.emitLine("return rewrittenMap, nil");
          return;
        }
        if (plan.directRewriteKind == "payloads") {
          this.render.emitLine("rewritten, err := r.rewritePayloadsJSON(value)");
          this.render.emitLine("if err != nil {");
          this.render.indent(() => this.render.emitLine("return nil, err"));
          this.render.emitLine("}");
          this.render.emitLine("rewrittenMap, ok := rewritten.(map[string]any)");
          this.render.emitLine("if !ok {");
          this.render.indent(() =>
            this.render.emitLine(
              'return nil, errors.New("temporal nexus payload visitor expected object JSON")',
            ),
          );
          this.render.emitLine("}");
          this.render.emitLine("return rewrittenMap, nil");
          return;
        }
        this.render.emitLine("rewritten := make(map[string]any, len(value))");
        this.render.emitBlock("for key, item := range value", () => {
          this.render.emitLine("rewritten[key] = item");
        });
        for (const fieldRewrite of plan.fieldRewrites) {
          this.emitTemporalFieldRewrite(fieldRewrite);
        }
        this.render.emitLine("return rewritten, nil");
      },
    );
  }

  emitTemporalFieldRewrite(fieldRewrite: TemporalFieldRewrite) {
    const fieldName = this.renderStringLiteral(fieldRewrite.jsonName);
    this.render.emitLine("if fieldValue, ok := rewritten[", fieldName, "]; ok && fieldValue != nil {");
    this.render.indent(() => {
      if (fieldRewrite.kind == "payload") {
        this.render.emitLine("rewrittenValue, err := r.rewritePayloadJSON(fieldValue)");
        this.render.emitLine("if err != nil {");
        this.render.indent(() => this.render.emitLine("return nil, err"));
        this.render.emitLine("}");
        this.render.emitLine("rewritten[", fieldName, "] = rewrittenValue");
        return;
      }
      if (fieldRewrite.kind == "payloads") {
        this.render.emitLine("rewrittenValue, err := r.rewritePayloadsJSON(fieldValue)");
        this.render.emitLine("if err != nil {");
        this.render.indent(() => this.render.emitLine("return nil, err"));
        this.render.emitLine("}");
        this.render.emitLine("rewritten[", fieldName, "] = rewrittenValue");
        return;
      }
      if (fieldRewrite.kind == "payloadMap") {
        const helperName =
          fieldRewrite.mapKind == "headerFields"
            ? "rewriteHeaderFieldsJSON"
            : fieldRewrite.mapKind == "memoFields"
              ? "rewriteMemoFieldsJSON"
              : "rewriteSearchAttributesFieldsJSON";
        this.render.emitLine(
          "rewrittenValue, err := r.",
          helperName,
          "(fieldValue)",
        );
        this.render.emitLine("if err != nil {");
        this.render.indent(() => this.render.emitLine("return nil, err"));
        this.render.emitLine("}");
        this.render.emitLine("rewritten[", fieldName, "] = rewrittenValue");
        return;
      }
      if (fieldRewrite.kind == "object") {
        this.render.emitLine("fieldMap, ok := fieldValue.(map[string]any)");
        this.render.emitLine("if !ok {");
        this.render.indent(() =>
          this.render.emitLine(
            'return nil, errors.New("temporal nexus payload visitor expected object field")',
          ),
        );
        this.render.emitLine("}");
        this.render.emitLine(
          "rewrittenValue, err := r.",
          fieldRewrite.helperName,
          "(fieldMap)",
        );
        this.render.emitLine("if err != nil {");
        this.render.indent(() => this.render.emitLine("return nil, err"));
        this.render.emitLine("}");
        this.render.emitLine("rewritten[", fieldName, "] = rewrittenValue");
        return;
      }
      if (fieldRewrite.kind == "array") {
        this.render.emitLine("fieldArray, ok := fieldValue.([]any)");
        this.render.emitLine("if !ok {");
        this.render.indent(() =>
          this.render.emitLine(
            'return nil, errors.New("temporal nexus payload visitor expected array field")',
          ),
        );
        this.render.emitLine("}");
        this.render.emitLine("rewrittenItems := make([]any, 0, len(fieldArray))");
        this.render.emitBlock("for _, item := range fieldArray", () => {
          this.render.emitLine("itemMap, ok := item.(map[string]any)");
          this.render.emitLine("if !ok {");
          this.render.indent(() =>
            this.render.emitLine(
              'return nil, errors.New("temporal nexus payload visitor expected object array item")',
            ),
          );
          this.render.emitLine("}");
          this.render.emitLine(
            "rewrittenItem, err := r.",
            fieldRewrite.helperName,
            "(itemMap)",
          );
          this.render.emitLine("if err != nil {");
          this.render.indent(() => this.render.emitLine("return nil, err"));
          this.render.emitLine("}");
          this.render.emitLine("rewrittenItems = append(rewrittenItems, rewrittenItem)");
        });
        this.render.emitLine("rewritten[", fieldName, "] = rewrittenItems");
        return;
      }
      this.render.emitLine("fieldMap, ok := fieldValue.(map[string]any)");
      this.render.emitLine("if !ok {");
      this.render.indent(() =>
        this.render.emitLine(
          'return nil, errors.New("temporal nexus payload visitor expected map field")',
        ),
      );
      this.render.emitLine("}");
      this.render.emitLine("rewrittenItems := make(map[string]any, len(fieldMap))");
      this.render.emitBlock("for key, item := range fieldMap", () => {
        this.render.emitLine("itemMap, ok := item.(map[string]any)");
        this.render.emitLine("if !ok {");
        this.render.indent(() =>
          this.render.emitLine(
            'return nil, errors.New("temporal nexus payload visitor expected object map item")',
          ),
        );
        this.render.emitLine("}");
        this.render.emitLine(
          "rewrittenItem, err := r.",
          fieldRewrite.helperName,
          "(itemMap)",
        );
        this.render.emitLine("if err != nil {");
        this.render.indent(() => this.render.emitLine("return nil, err"));
        this.render.emitLine("}");
        this.render.emitLine("rewrittenItems[key] = rewrittenItem");
      });
      this.render.emitLine("rewritten[", fieldName, "] = rewrittenItems");
    });
    this.render.emitLine("}");
  }

  emitTemporalNexusPayloadRegistry() {
    const payloadVisitors = this.getNexusPayloadVisitors();
    if (
      !this.nexusRendererOptions.temporalNexusPayloadCodecSupport ||
      payloadVisitors.length == 0
    ) {
      return;
    }

    const commonv1 = this.imports["go.temporal.io/api/common/v1"];
    const proto = this.imports["google.golang.org/protobuf/proto"];

    for (const visitor of payloadVisitors) {
      this.render.emitBlock(
        [
          "func ",
          visitor.helperName,
          "(",
          "payload *",
          commonv1,
          ".Payload, payloadVisitor TemporalNexusPayloadVisitorFunc, visitSearchAttributes bool",
          ") (*",
          commonv1,
          ".Payload, error)",
        ],
        () => {
          this.render.emitLine("var value any");
          this.render.emitLine("if err := json.Unmarshal(payload.GetData(), &value); err != nil {");
          this.render.indent(() => this.render.emitLine("return payload, nil"));
          this.render.emitLine("}");
          this.render.emitLine("valueMap, ok := value.(map[string]any)");
          this.render.emitLine("if !ok {");
          this.render.indent(() => this.render.emitLine("return payload, nil"));
          this.render.emitLine("}");
          this.render.emitLine(
            "visitor := &temporalNexusPayloadVisitor{payloadVisitor: payloadVisitor, visitSearchAttributes: visitSearchAttributes}",
          );
          this.render.emitLine(
            "rewrittenValue, err := visitor.",
            this.makeTemporalClassRewriteHelperName(visitor.inputTypeName),
            "(valueMap)",
          );
          this.render.emitLine("if err != nil {");
          this.render.indent(() => this.render.emitLine("return nil, err"));
          this.render.emitLine("}");
          this.render.emitLine("rewrittenData, err := json.Marshal(rewrittenValue)");
          this.render.emitLine("if err != nil {");
          this.render.indent(() => this.render.emitLine("return nil, err"));
          this.render.emitLine("}");
          this.render.emitLine(
            "rewrittenPayload := ",
            proto,
            ".Clone(payload).(*",
            commonv1,
            ".Payload)",
          );
          this.render.emitLine("rewrittenPayload.Data = rewrittenData");
          this.render.emitLine("return rewrittenPayload, nil");
        },
      );
      this.render.ensureBlankLine();
    }

    this.render.emitLine(
      "var TemporalNexusPayloadVisitors = map[TemporalNexusPayloadVisitorKey]TemporalNexusPayloadVisitor{",
    );
    this.render.indent(() => {
      for (const visitor of payloadVisitors) {
        this.render.emitLine(
          "{ServiceName: ",
          this.renderStringLiteral(visitor.serviceName),
          ", OperationName: ",
          this.renderStringLiteral(visitor.operationName),
          "}: ",
          visitor.helperName,
          ",",
        );
      }
    });
    this.render.emitLine("}");
    this.render.ensureBlankLine();
    this.render.emitBlock(
      "func GetTemporalNexusPayloadVisitor(serviceName, operationName string) TemporalNexusPayloadVisitor",
      () => {
        this.render.emitLine(
          "return TemporalNexusPayloadVisitors[TemporalNexusPayloadVisitorKey{ServiceName: serviceName, OperationName: operationName}]",
        );
      },
    );
    this.render.ensureBlankLine();
    this.render.emitBlock(
      "func IsTemporalNexusOperation(serviceName, operationName string) bool",
        () => {
        this.render.emitLine(
          "return GetTemporalNexusPayloadVisitor(serviceName, operationName) != nil",
        );
      },
    );
  }

  getNexusPayloadVisitors(): readonly TemporalOperationPayloadVisitor[] {
    if (this.nexusPayloadVisitors) {
      return this.nexusPayloadVisitors;
    }
    this.nexusPayloadVisitors = Object.entries(this.schema.services).flatMap(
      ([serviceName, service]) =>
        Object.entries(service.operations).flatMap(
          ([operationName, operation]) => {
            if (operation.input?.kind != "jsonSchema") {
              return [];
            }
            const plan = this.getTemporalClassRewritePlanByName(
              operation.input.name,
            );
            if (!plan) {
              return [];
            }
            return [
              {
                serviceName,
                operationName,
                inputTypeName: operation.input.name,
                helperName: this.makeTemporalNexusRewriterFunctionName(
                  operation.input.name,
                ),
              },
            ];
          },
        ),
    );
    return this.nexusPayloadVisitors;
  }

  getTemporalClassRewritePlans(): ReadonlyMap<
    string,
    TemporalClassRewritePlan
  > {
    if (!this.temporalClassRewritePlans) {
      this.temporalClassRewritePlans = new Map();
      for (const visitor of this.getNexusPayloadVisitors()) {
        this.getTemporalClassRewritePlanByName(visitor.inputTypeName);
      }
    }
    return this.temporalClassRewritePlans;
  }

  getTemporalClassRewritePlanByName(
    typeName: string,
  ): TemporalClassRewritePlan | undefined {
    const topLevel = this.render.topLevels.get(typeName);
    if (!(topLevel instanceof ClassType)) {
      return undefined;
    }
    return this.getTemporalClassRewritePlan(topLevel);
  }

  getTemporalClassRewritePlan(
    type: ClassType,
  ): TemporalClassRewritePlan | undefined {
    const typeName = this.render.sourcelikeToString(this.render.goType(type));
    const existingPlan = this.temporalClassRewritePlans?.get(typeName);
    if (existingPlan) {
      return existingPlan;
    }
    if (this.temporalClassRewritePlanInProgress?.has(typeName)) {
      return undefined;
    }
    if (!this.temporalClassRewritePlanInProgress) {
      this.temporalClassRewritePlanInProgress = new Set();
    }
    this.temporalClassRewritePlanInProgress.add(typeName);

    try {
      const directRewriteKind = this.getTemporalDirectRewriteKind(typeName);
      const fieldRewrites: TemporalFieldRewrite[] = [];
      for (const [jsonName, property] of type.getProperties()) {
        const terminalRewrite = this.getTemporalTerminalFieldRewrite(
          typeName,
          jsonName,
        );
        if (terminalRewrite) {
          fieldRewrites.push(terminalRewrite);
          continue;
        }
        const childRewrite = this.getTemporalChildFieldRewrite(
          property.type,
          jsonName,
        );
        if (childRewrite) {
          fieldRewrites.push(childRewrite);
        }
      }
      if (!directRewriteKind && fieldRewrites.length == 0) {
        return undefined;
      }
      const plan: TemporalClassRewritePlan = {
        typeName,
        helperName: this.makeTemporalClassRewriteHelperName(typeName),
        directRewriteKind,
        onlyWhenVisitSearchAttributes: typeName == "SearchAttributes",
        fieldRewrites,
      };
      if (!this.temporalClassRewritePlans) {
        this.temporalClassRewritePlans = new Map();
      }
      this.temporalClassRewritePlans.set(typeName, plan);
      return plan;
    } finally {
      this.temporalClassRewritePlanInProgress.delete(typeName);
    }
  }

  getTemporalDirectRewriteKind(
    typeName: string,
  ): TemporalTerminalRewriteKind | undefined {
    if (typeName == "Input") {
      return "payloads";
    }
    return undefined;
  }

  getTemporalTerminalFieldRewrite(
    typeName: string,
    jsonName: string,
  ): TemporalFieldRewrite | undefined {
    if (typeName == "Header" && jsonName == "fields") {
      return { kind: "payloadMap", jsonName, mapKind: "headerFields" };
    }
    if (typeName == "Memo" && jsonName == "fields") {
      return { kind: "payloadMap", jsonName, mapKind: "memoFields" };
    }
    if (typeName == "SearchAttributes" && jsonName == "indexedFields") {
      return { kind: "payloadMap", jsonName, mapKind: "searchAttributes" };
    }
    if (
      typeName == "UserMetadata" &&
      (jsonName == "summary" || jsonName == "details")
    ) {
      return { kind: "payload", jsonName };
    }
    if (typeName == "Input" && jsonName == "payloads") {
      return { kind: "payloads", jsonName };
    }
    return undefined;
  }

  getTemporalChildFieldRewrite(
    type: Type,
    jsonName: string,
  ): TemporalFieldRewrite | undefined {
    const normalizedType = this.unwrapNullableType(type);
    if (!normalizedType) {
      return undefined;
    }
    if (normalizedType instanceof ClassType) {
      const plan = this.getTemporalClassRewritePlan(normalizedType);
      return plan
        ? { kind: "object", jsonName, helperName: plan.helperName }
        : undefined;
    }
    if (normalizedType instanceof ArrayType) {
      const itemType = this.unwrapNullableType(normalizedType.items);
      if (itemType instanceof ClassType) {
        const plan = this.getTemporalClassRewritePlan(itemType);
        return plan
          ? { kind: "array", jsonName, helperName: plan.helperName }
          : undefined;
      }
      return undefined;
    }
    if (normalizedType instanceof MapType) {
      const valueType = this.unwrapNullableType(normalizedType.values);
      if (valueType instanceof ClassType) {
        const plan = this.getTemporalClassRewritePlan(valueType);
        return plan
          ? { kind: "map", jsonName, helperName: plan.helperName }
          : undefined;
      }
    }
    return undefined;
  }

  unwrapNullableType(type: Type): Type | undefined {
    if (!(type instanceof UnionType)) {
      return type;
    }
    const nonNullMembers = [...type.members].filter(
      (member) => member.kind != "null",
    );
    return nonNullMembers.length == 1 ? nonNullMembers[0] : undefined;
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

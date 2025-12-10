import {
  ConvenienceRenderer,
  Name,
  Namer,
  type RendererOptions,
  type Sourcelike,
} from "quicktype-core";
import {
  getNexusRendererOptions,
  type NexusRendererOptions,
  type PreparedSchema,
} from "./generator.js";
import { proxyWithOverrides } from "./utility.js";
import type {
  BlankLineConfig,
  ForEachPosition,
  Renderer,
} from "quicktype-core/dist/Renderer.js";
import type {
  ClassProperty,
  ClassType,
  EnumType,
  ObjectType,
  Type,
  TypeGraph,
  UnionType,
} from "quicktype-core/dist/Type/index.js";
import type { ForbiddenWordsInfo } from "quicktype-core/dist/ConvenienceRenderer.js";
import { FixedName } from "quicktype-core/dist/Naming.js";

type AnyFunction = (...arguments_: any[]) => any;

export abstract class RenderAdapter<AccessibleRenderer> {
  public readonly render: AccessibleRenderer &
    RenderAccessible &
    ConvenienceRenderer;
  protected readonly nexusRendererOptions: NexusRendererOptions;
  private readonly serviceTypeNamesInUse: Record<string, boolean> = {};

  constructor(render: ConvenienceRenderer, rendererOptions: RendererOptions) {
    this.render = render as any;
    this.nexusRendererOptions = getNexusRendererOptions(rendererOptions);
  }

  public get schema(): PreparedSchema {
    return this.nexusRendererOptions.nexusSchema;
  }

  makeRenderer<T extends ConvenienceRenderer>(overrides: {
    [K in keyof AccessibleRenderer]?: AccessibleRenderer[K] extends AnyFunction
      ? (
          this: AccessibleRenderer,
          original: AccessibleRenderer[K],
          ...arguments_: Parameters<AccessibleRenderer[K]>
        ) => ReturnType<AccessibleRenderer[K]>
      : never;
  }): T {
    return proxyWithOverrides(
      this.render as ConvenienceRenderer,
      overrides,
    ) as T;
  }

  makeServiceTypeName(idealName: string) {
    // If name in use but not with services, suffix "Service"
    if (this.topLevelNameInUse(idealName, false)) {
      idealName += "Service";
    }
    // If name in use, append number, starting with 2
    if (this.topLevelNameInUse(idealName, true)) {
      for (let index = 2; ; index++) {
        if (!this.topLevelNameInUse(`${idealName}${index}`, true)) {
          idealName += `${index}`;
          break;
        }
      }
    }
    this.serviceTypeNamesInUse[idealName] = true;
    return idealName;
  }

  makeOperationFunctionName(idealName: string, inUse: Record<string, boolean>) {
    // If forbidden, suffix with "Operation"
    if (this.opNameForbidden(idealName)) {
      idealName += "Operation";
    }
    // Append numbers starting with 2 if already in use
    if (Object.hasOwn(inUse, idealName)) {
      for (let index = 2; ; index++) {
        if (!Object.hasOwn(inUse, `${idealName}${index}`)) {
          idealName += `${index}`;
          break;
        }
      }
    }
    inUse[idealName] = true;
    return idealName;
  }

  topLevelNameInUse(name: string, includeServices: boolean) {
    // Considered in use if forbidden
    if (this.render.forbiddenNamesForGlobalNamespace().includes(name)) {
      return true;
    }

    // Check services
    if (includeServices && Object.hasOwn(this.serviceTypeNamesInUse, name)) {
      return true;
    }
    let inNames = false;
    this.render.names.forEach((value) => {
      if (value == name) {
        inNames = true;
      }
    });
    return inNames;
  }

  opNameForbidden(name: string) {
    // TODO(cretz): hacking undefined in for object type ok?
    const info = this.render.forbiddenForObjectProperties(
      undefined as any,
      new FixedName(name),
    );
    if (info.includeGlobalForbidden && this.topLevelNameInUse(name, true)) {
      return true;
    }
    for (const badName of info.names) {
      if (badName instanceof Name) {
        if (name == this.render.names.get(badName)) {
          return true;
        }
      } else if (name == badName) {
        return true;
      }
    }
    return false;
  }
}

export interface RenderAccessible {
  readonly typeGraph: TypeGraph;
  descriptionForClassProperty(
    o: ObjectType,
    name: string,
  ): string[] | undefined;
  descriptionForType(t: Type): string[] | undefined;
  emitDescription(description: Sourcelike[] | undefined): void;
  emitGatheredSource(items: Sourcelike[]): void;
  emitLineOnce(...lineParts: Sourcelike[]): void;
  emitSourceStructure(givenOutputFilename: string): void;
  emitTable(tableArray: Sourcelike[][]): void;
  finishFile(filename: string): void;
  forbiddenForObjectProperties(
    _o: ObjectType,
    _className: Name,
  ): ForbiddenWordsInfo;
  forbiddenNamesForGlobalNamespace(): readonly string[];
  forEachClassProperty(
    o: ObjectType,
    blankLocations: BlankLineConfig,
    f: (
      name: Name,
      jsonName: string,
      p: ClassProperty,
      position: ForEachPosition,
    ) => void,
  ): void;
  forEachNamedType(
    blankLocations: BlankLineConfig,
    objectFunction:
      | ((c: ClassType, className: Name, position: ForEachPosition) => void)
      | ((o: ObjectType, objectName: Name, position: ForEachPosition) => void),
    enumFunction: (
      enm: EnumType,
      enumName: Name,
      position: ForEachPosition,
    ) => void,
    unionFunction: (
      u: UnionType,
      unionName: Name,
      position: ForEachPosition,
    ) => void,
  ): void;
  forEachTopLevel(
    blankLocations: BlankLineConfig,
    f: (t: Type, name: Name, position: ForEachPosition) => void,
    predicate?: (t: Type) => boolean,
  ): boolean;
  forEachWithBlankLines<K, V>(
    iterable: Iterable<[K, V]>,
    blankLineConfig: BlankLineConfig,
    emitter: (v: V, k: K, position: ForEachPosition) => void,
  ): boolean;
  gatherSource(emitter: () => void): Sourcelike[];
  makeNamedTypeNamer(): Namer;
  makeNameForTopLevel(
    _t: Type,
    givenName: string,
    _maybeNamedType: Type | undefined,
  ): Name;
  nameForNamedType(t: Type): Name;
  namerForObjectProperty(o: ObjectType, p: ClassProperty): Namer | null;
  sourcelikeToString(source: Sourcelike): string;
}

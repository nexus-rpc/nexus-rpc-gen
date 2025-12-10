import wordwrap from "wordwrap";

type AnyFunction = (...arguments_: any[]) => any;

/**
 * A helper that proxies an instance and overrides selected methods.
 * The overrides receive both the original method and its typed parameters.
 */
export function proxyWithOverrides<T extends object>(
  instance: T,
  overrides: {
    [K in keyof T]?: T[K] extends AnyFunction
      ? (
          this: T,
          original: T[K],
          ...arguments_: Parameters<T[K]>
        ) => ReturnType<T[K]>
      : never;
  },
): T {
  return new Proxy(instance, {
    get(target, property, receiver) {
      // @ts-expect-error index signature is fine for Proxy
      const override = overrides[property];
      if (typeof override === "function") {
        const original = Reflect.get(target, property, receiver);
        return function (this: T, ...arguments_: any[]) {
          // Call the override, passing original and args
          return override.call(
            this,
            (original as any).bind(this),
            ...arguments_,
          );
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

const wordWrap = wordwrap(90);

export function splitDescription(
  string_: string | undefined,
): string[] | undefined {
  if (!string_) {
    return undefined;
  }
  return wordWrap(string_)
    .split("\n")
    .map((l) => l.trim());
}

import * as nexus from "nexus-rpc";
import { type MyExistingType } from "./types.js";
import { type URL } from "node:url";

/**
 * A service for all types of operations
 */
export const kitchenSinkService = nexus.service("KitchenSinkService", {
  /**
   * Counts the characters in the string
   */
  scalarArgScalarResult: nexus.operation<
    KitchenSinkServiceScalarArgScalarResultInput,
    KitchenSinkServiceScalarArgScalarResultOutput
  >(),

  /**
   * Counts the characters in a string
   */
  complexArgComplexResultInline: nexus.operation<
    KitchenSinkServiceComplexArgumentComplexResultInlineInput,
    KitchenSinkServiceComplexArgumentComplexResultInlineOutput
  >(),

  scalarArgScalarResultExternal: nexus.operation<ScalarInput, ScalarOutput>(),

  complexArgComplexResultExternal: nexus.operation<
    ComplexInput,
    ComplexOutput
  >(),
});

export const strangeItem = nexus.service("Strange{Item}", {
  strangeItem: nexus.operation<StrangeItem, PurpleStrangeItem>({
    name: "Strange{Item}",
  }),

  strangeItem2: nexus.operation<void, void>({ name: "StrangeItem" }),
});

export const strangeItem2 = nexus.service("StrangeItem", {});

export const reservedWordService = nexus.service("ReservedWordService", {
  toStringOperation: nexus.operation<void, void>({ name: "ToString" }),
});

export const existingTypesService = nexus.service("ExistingTypesService", {
  specificTypesForSomeLangs: nexus.operation<ComplexInput, URL>(),

  specificTypesForOtherLangs: nexus.operation<MyExistingType, ComplexOutput>(),
});

export const dateService = nexus.service("DateService", {
  dateOperation: nexus.operation<DateInput, void>(),
});

/**
 * String to count
 */
export type KitchenSinkServiceScalarArgScalarResultInput = string;

/**
 * Count of characters
 */
export type KitchenSinkServiceScalarArgScalarResultOutput = number;

/**
 * String to count
 */
export type ScalarInput = string;

/**
 * Count of characters
 */
export type ScalarOutput = number;

/**
 * Input type
 */
export interface KitchenSinkServiceComplexArgumentComplexResultInlineInput {
  /**
   * String to count
   */
  string?: string;
}

/**
 * Output type
 */
export interface KitchenSinkServiceComplexArgumentComplexResultInlineOutput {
  /**
   * Count of characters
   */
  characterCount?: number;
}

export interface ComplexInput {
  selfRef?: ComplexInput;
  someSharedObj?: SharedObject;
}

export interface SharedObject {
  someField?: number;
}

export interface ComplexOutput {
  selfRef?: ComplexOutput;
  someSharedObj?: SharedObject;
}

export interface StrangeItem {
  someField?: number;
}

export interface PurpleStrangeItem {
  someField?: number;
}

export interface DateInput {
  date?: Date;
  dateTime?: Date;
  time?: string;
  [property: string]: any;
}

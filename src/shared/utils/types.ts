/*
 * RequireAtLeastOne
 *
 * From https://stackoverflow.com/a/49725198/435093
 *
 * This type is used to make sure that at least one of the fields is present.
 *
 * For example, in the PackageOptions type, we want to make sure that at least one of the fields
 * imageHash, imageTag, or manifest is present.
 */

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * Utility type extracting the type of the element of a typed array
 */
export type ElementOf<T> = T extends Array<infer U> ? U : never;

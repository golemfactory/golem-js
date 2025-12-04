export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
}[Keys];
/**
 * Utility type extracting the type of the element of a typed array
 */
export type ElementOf<T> = T extends Array<infer U> ? U : never;

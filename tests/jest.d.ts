/// <reference types="jest" />

declare namespace jest {
  interface Matchers<R> {
    toMatchError(error: Error): R;
  }
}

type MatcherContext = jest.MatcherContext;
type CustomMatcherResult = jest.CustomMatcherResult;

function errorToObject(error: Error) {
  const { stack, ...publicFields } = error;

  return {
    class: error.constructor,
    message: error.message,
    publicFields,
  };
}

type ErrorFactory = Error | (() => void);
function unwrapErrorFactory(value: ErrorFactory): Error | undefined {
  if (typeof value === "function") {
    try {
      value();
    } catch (error) {
      return error;
    }
  } else {
    return value;
  }
}

export function toMatchError(
  this: MatcherContext,
  gotErrorFactory: Error | (() => void),
  expectedError: Error,
): CustomMatcherResult {
  const gotError = unwrapErrorFactory(gotErrorFactory);
  const expected = errorToObject(expectedError);

  const diff: string[] = [];
  if (gotError === undefined) {
    diff.push("Expected to receive an error, but no error was thrown");
  } else {
    const got = errorToObject(gotError);

    if (got.class !== expected.class) {
      diff.push("Error class is not the same:", this.utils.diff(expected.class, got.class) as string);
    }

    if (got.message !== expected.message) {
      diff.push("Error message is not the same:", this.utils.diff(expected.message, got.message) as string);
    }

    for (const key of Object.keys(expected.publicFields)) {
      if (expected.publicFields[key]?.constructor) {
        if (expected.publicFields[key].constructor.toString() !== got.publicFields?.[key]?.constructor.toString()) {
          diff.push(
            `Error field "${key}" class is not the same:`,
            this.utils.diff(
              expected.publicFields[key].constructor.toString(),
              got.publicFields?.[key]?.constructor.toString(),
            ) as string,
          );
        }
      }
      if (!this.equals(expected.publicFields[key], got.publicFields?.[key])) {
        diff.push(
          `Error public field "${key}" are not the same:`,
          this.utils.diff(`${expected.publicFields[key]}`, `${got.publicFields?.[key]}`) as string,
        );
      }
    }
  }

  return {
    pass: diff.length === 0,
    message: () => diff.join("\n"),
  };
}

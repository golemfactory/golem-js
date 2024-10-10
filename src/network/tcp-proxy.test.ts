jest.mock("../shared/utils", () => ({
  checkAndThrowUnsupportedInBrowserError: () => {
    throw new GolemUserError("Not supported in browser");
  },
}));

import { GolemUserError } from "../shared/error/golem-error";

import { TcpProxy } from "./tcp-proxy";

describe("TCP Proxy in browser", () => {
  test("Uses the checkAndThrowUnsupportedInBrowserError util to throw when the function detects browser environment", () => {
    expect(() => new TcpProxy("ws://fake.url", "fake-app-key")).toThrow("Not supported in browser");
  });
});

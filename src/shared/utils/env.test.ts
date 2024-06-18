import { EnvUtils } from "./index";

describe("EnvUtils", () => {
  describe("getYagnaApiUrl()", () => {
    describe("with env", () => {
      let oldUrl: string | undefined;

      beforeEach(() => {
        oldUrl = process.env.YAGNA_API_URL;
        process.env.YAGNA_API_URL = "TEST";
      });

      afterEach(() => {
        if (typeof oldUrl === "undefined") {
          delete process.env.YAGNA_API_URL;
        } else {
          process.env.YAGNA_API_URL = oldUrl;
        }
      });

      it("should use process.env if available", () => {
        expect(EnvUtils.getYagnaApiUrl()).toEqual("TEST");
      });

      it("should return default if env is missing", () => {
        delete process.env.YAGNA_API_URL;
        expect(EnvUtils.getYagnaApiUrl()).toEqual("http://127.0.0.1:7465");
      });
    });

    describe("without env", () => {
      let process: NodeJS.Process | undefined;

      beforeEach(() => {
        process = global.process;
        global.process = undefined as unknown as NodeJS.Process;
      });

      afterEach(() => {
        global.process = process as NodeJS.Process;
      });

      it("should return default value", () => {
        expect(EnvUtils.getYagnaApiUrl()).toEqual("http://127.0.0.1:7465");
      });
    });
  });

  describe("getYagnaAppKey()", () => {
    describe("with env", () => {
      let oldKey: string | undefined;

      beforeEach(() => {
        oldKey = process.env.YAGNA_APPKEY;
        process.env.YAGNA_APPKEY = "TEST";
      });

      afterEach(() => {
        if (typeof oldKey === "undefined") {
          delete process.env.YAGNA_APPKEY;
        } else {
          process.env.YAGNA_APPKEY = oldKey;
        }
      });

      it("should use process.env if available", () => {
        expect(EnvUtils.getYagnaAppKey()).toEqual("TEST");
      });

      it("should return empty string if var is missing", () => {
        delete process.env.YAGNA_APPKEY;
        expect(EnvUtils.getYagnaAppKey()).toEqual("");
      });
    });

    describe("without env", () => {
      let process: NodeJS.Process | undefined;

      beforeEach(() => {
        process = global.process;
        global.process = undefined as unknown as NodeJS.Process;
      });

      afterEach(() => {
        global.process = process as NodeJS.Process;
      });

      it("should return empty string", () => {
        expect(EnvUtils.getYagnaAppKey()).toEqual("");
      });
    });
  });
});

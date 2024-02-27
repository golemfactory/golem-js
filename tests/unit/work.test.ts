import * as activityMock from "../mock/rest/activity";
import { Activity, GolemModuleError, GolemWorkError, WorkContext, WorkErrorCode } from "../../src";
import { LoggerMock, StorageProviderMock, YagnaMock } from "../mock";
import { agreement } from "../mock/entities/agreement";

const logger = new LoggerMock();
const yagnaApi = new YagnaMock().getApi();
const storageProviderMock = new StorageProviderMock({ logger });

describe("Work Context", () => {
  beforeEach(() => {
    logger.clear();
    activityMock.clear();
  });

  const commonWorkOptions = {
    yagnaOptions: yagnaApi.yagnaOptions,
    logger,
    activityStateCheckingInterval: 10,
    storageProvider: storageProviderMock,
  };

  describe("Executing", () => {
    it("should execute run command", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const worker = async (ctx: WorkContext) => ctx.run("some_shell_command");
      const ctx = new WorkContext(activity, commonWorkOptions);
      await ctx.before();
      const results = await worker(ctx);
      expect(results?.stdout).toEqual("test_result");
    });

    it("should execute upload file command", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const worker = async (ctx: WorkContext) => ctx.uploadFile("./file.txt", "/golem/file.txt");
      const ctx = new WorkContext(activity, commonWorkOptions);
      await ctx.before();
      const results = await worker(ctx);
      expect(results?.stdout).toEqual("test_result");
      await logger.expectToInclude("File published", { src: "./file.txt" });
    });

    it("should execute upload json command", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const worker = async (ctx: WorkContext) => ctx.uploadJson({ test: true }, "/golem/file.txt");
      const ctx = new WorkContext(activity, commonWorkOptions);
      await ctx.before();
      const results = await worker(ctx);
      expect(results?.stdout).toEqual("test_result");
      await logger.expectToInclude("Data published", { data: expect.anything() });
    });

    it("should execute download file command", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const worker = async (ctx: WorkContext) => ctx.downloadFile("/golem/file.txt", "./file.txt");
      const ctx = new WorkContext(activity, commonWorkOptions);
      await ctx.before();
      const results = await worker(ctx);
      expect(results?.stdout).toEqual("test_result");
      await logger.expectToInclude("File received", { path: "./file.txt" });
    });
  });
  describe("Batch", () => {
    it("should execute batch as promise", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const worker = async (ctx: WorkContext) => {
        return ctx
          .beginBatch()
          .run("some_shell_command")
          .uploadFile("./file.txt", "/golem/file.txt")
          .uploadJson({ test: true }, "/golem/file.txt")
          .downloadFile("/golem/file.txt", "./file.txt")
          .end();
      };
      const ctx = new WorkContext(activity, commonWorkOptions);
      const expectedStdout = [
        { stdout: "ok_run" },
        { stdout: "ok_upload_file" },
        { stdout: "ok_upload_json" },
        { stdout: "ok_download_file" },
      ];
      activityMock.setExpectedExeResults(expectedStdout);
      const results = await worker(ctx);
      expect(results?.map((r) => r.stdout)).toEqual(expectedStdout.map((s) => s.stdout));
      await logger.expectToInclude("File published", { src: "./file.txt" });
      await logger.expectToInclude("Data published", { data: expect.anything() });
      await logger.expectToInclude("File received", { path: "./file.txt" });
    });

    it("should execute batch as stream", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const worker = async (ctx: WorkContext) => {
        return ctx
          .beginBatch()
          .run("some_shell_command")
          .uploadFile("./file.txt", "/golem/file.txt")
          .uploadJson({ test: true }, "/golem/file.txt")
          .downloadFile("/golem/file.txt", "./file.txt")
          .endStream();
      };
      const ctx = new WorkContext(activity, commonWorkOptions);
      const expectedStdout = [
        { stdout: "ok_run" },
        { stdout: "ok_upload_file" },
        { stdout: "ok_upload_json" },
        { stdout: "ok_download_file" },
      ];
      activityMock.setExpectedExeResults(expectedStdout);
      const results = await worker(ctx);
      await new Promise((res, rej) => {
        results?.on("data", (result) => {
          try {
            expect(result.stdout).toEqual(expectedStdout?.shift()?.stdout);
          } catch (e) {
            rej(e);
          }
        });
        results?.on("end", res);
      });
      await logger.expectToInclude("File published", { src: "./file.txt" });
      await logger.expectToInclude("Data published", { data: expect.anything() });
      await logger.expectToInclude("File received", { path: "./file.txt" });
    });
  });
  describe("Error handling", () => {
    it("should return a result with error in case the command to execute is invalid", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const worker = async (ctx: WorkContext) => ctx.beginBatch().run("invalid_shell_command").end();
      const ctx = new WorkContext(activity, commonWorkOptions);
      const expectedStdout = [{ result: "Error", stderr: "error", message: "Some error occurred" }];
      activityMock.setExpectedExeResults(expectedStdout);

      const [result] = await worker(ctx);

      expect(result.result).toEqual("Error");
      expect(result.message).toEqual("Some error occurred");
    });

    it("should catch error while executing batch as stream with invalid command", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const worker = async (ctx: WorkContext) => ctx.beginBatch().run("invalid_shell_command").endStream();
      const ctx = new WorkContext(activity, commonWorkOptions);
      const expectedStdout = [{ result: "Error", stderr: "error", message: "Some error occurred" }];
      activityMock.setExpectedExeResults(expectedStdout);
      const results = await worker(ctx);

      await new Promise((res) =>
        results.once("error", (error: GolemModuleError) => {
          expect(error.message).toEqual("Some error occurred. Stdout: test_result. Stderr: error");
          expect(error).toBeInstanceOf(GolemWorkError);
          expect(error.code).toEqual(WorkErrorCode.ScriptExecutionFailed);
          res(true);
        }),
      );
    });
  });
});

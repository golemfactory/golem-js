import { DownloadFile, Run, Transfer, UploadData, UploadFile } from "../script";
import { Batch } from "./batch";
import { NullStorageProvider } from "../../shared/storage";
import { Activity, Result } from "../index";
import { GolemWorkError, WorkErrorCode } from "./error";
import { anything, imock, instance, mock, reset, when } from "@johanblumenberg/ts-mockito";
import { Logger, YagnaApi } from "../../shared/utils";
import {
  buildExeScriptSuccessResult,
  buildExeScriptErrorResult,
  buildExecutorResults,
} from "../../../tests/utils/helpers";
import { Agreement } from "../../market/agreement";

import { ExeScriptExecutor } from "../exe-script-executor";
import { lastValueFrom, of, toArray } from "rxjs";

const mockLogger = imock<Logger>();
const mockYagna = mock(YagnaApi);
const mockActivity = mock(Activity);
const mockAgreement = mock(Agreement);
const mockExecutor = mock(ExeScriptExecutor);

describe("Batch", () => {
  let activity: Activity;
  let batch: Batch;

  beforeEach(() => {
    reset(mockLogger);
    reset(mockYagna);
    reset(mockActivity);
    reset(mockAgreement);
    reset(mockExecutor);

    const providerInfo = {
      id: "provider-id",
      name: "Test Provider",
      walletAddress: "0xTestProvider",
    };

    when(mockAgreement.provider).thenReturn(providerInfo);
    when(mockActivity.provider).thenReturn(providerInfo);
    when(mockActivity.agreement).thenReturn(instance(mockAgreement));
    when(mockExecutor.getResultsObservable(anything())).thenReturn(of());

    activity = instance(mockActivity);

    when(mockExecutor.activity).thenReturn(activity);
    batch = new Batch(instance(mockExecutor), new NullStorageProvider(), instance(mockLogger));
  });

  describe("Commands", () => {
    describe("run()", () => {
      it("should accept shell command", async () => {
        expect(batch.run("rm -rf")).toBe(batch);
        expect(batch["script"]["commands"][0]).toBeInstanceOf(Run);
        expect(batch["script"]["commands"][0]["args"]["entry_point"]).toBe("/bin/sh");
        expect(batch["script"]["commands"][0]["args"]["args"]).toStrictEqual(["-c", "rm -rf"]);
      });

      it("should accept executable", async () => {
        expect(batch.run("/bin/bash", ["-c", "echo Hello"])).toBe(batch);
        expect(batch["script"]["commands"][0]).toBeInstanceOf(Run);
      });
    });

    describe("transfer()", () => {
      it("should add transfer file command", async () => {
        expect(batch.transfer("http://golem.network/test.txt", "/golem/file.txt")).toBe(batch);
        const cmd = batch["script"]["commands"][0] as Transfer;
        expect(cmd).toBeInstanceOf(Transfer);
        expect(cmd["from"]).toBe("http://golem.network/test.txt");
        expect(cmd["to"]).toBe("/golem/file.txt");
      });
    });

    describe("uploadFile()", () => {
      it("should add upload file command", async () => {
        expect(batch.uploadFile("/tmp/file.txt", "/golem/file.txt")).toBe(batch);
        const cmd = batch["script"]["commands"][0] as UploadFile;
        expect(cmd).toBeInstanceOf(UploadFile);
        expect(cmd["src"]).toBe("/tmp/file.txt");
        expect(cmd["dstPath"]).toBe("/golem/file.txt");
      });
    });

    describe("uploadJson()", () => {
      it("should execute upload json command", async () => {
        const input = { hello: "world" };
        expect(batch.uploadJson(input, "/golem/file.txt")).toBe(batch);
        const cmd = batch["script"]["commands"][0] as UploadData;
        expect(cmd).toBeInstanceOf(UploadData);
        expect(JSON.parse(new TextDecoder().decode(cmd["src"]))).toEqual(input);
        expect(cmd["dstPath"]).toBe("/golem/file.txt");
      });
    });

    describe("uploadData()", () => {
      it("should execute upload json command", async () => {
        const input = "Hello World";
        expect(batch.uploadData(new TextEncoder().encode(input), "/golem/file.txt")).toBe(batch);
        const cmd = batch["script"]["commands"][0] as UploadData;
        expect(cmd).toBeInstanceOf(UploadData);
        expect(new TextDecoder().decode(cmd["src"])).toEqual(input);
        expect(cmd["dstPath"]).toBe("/golem/file.txt");
      });
    });

    describe("downloadFile()", () => {
      it("should execute download file command", async () => {
        expect(batch.downloadFile("/golem/file.txt", "/tmp/file.txt")).toBe(batch);
        const cmd = batch["script"]["commands"][0] as DownloadFile;
        expect(cmd).toBeInstanceOf(DownloadFile);
        expect(cmd["srcPath"]).toBe("/golem/file.txt");
        expect(cmd["dstPath"]).toBe("/tmp/file.txt");
      });
    });
  });

  describe("end()", () => {
    beforeEach(() => {
      batch.run("echo 'Hello World'").run("echo 'Hello World 2'");
    });

    it("should work", async () => {
      when(mockExecutor.getResultsObservable(anything())).thenReturn(
        buildExecutorResults([
          buildExeScriptSuccessResult("Hello World"),
          buildExeScriptSuccessResult("Hello World 2"),
        ]),
      );

      const results = await batch.end();

      expect(results.length).toBe(2);
      expect(results[0].stdout).toBe("Hello World");
      expect(results[1].stdout).toBe("Hello World 2");
    });

    it("should initialize script with script.before()", async () => {
      const spy = jest.spyOn(batch["script"], "before");
      when(mockExecutor.getResultsObservable(anything())).thenReturn(buildExecutorResults([]));
      await batch.end();

      expect(spy).toHaveBeenCalled();
    });

    it("should call script.after() on success", async () => {
      const spy = jest.spyOn(batch["script"], "after");
      when(mockExecutor.getResultsObservable(anything())).thenReturn(buildExecutorResults([]));
      await batch.end();

      expect(spy).toHaveBeenCalled();
    });

    it("should call script.after() on failure", async () => {
      const spy = jest.spyOn(batch["script"], "after");

      when(mockExecutor.getResultsObservable(anything())).thenReturn(
        buildExecutorResults(undefined, undefined, new Error("FAILURE")),
      );

      await expect(batch.end()).rejects.toMatchError(
        new GolemWorkError(
          "Unable to execute script Error: FAILURE",
          WorkErrorCode.ScriptExecutionFailed,
          activity.agreement,
          activity,
          activity.provider,
          new Error("FAILURE"),
        ),
      );

      expect(spy).toHaveBeenCalled();
    });

    it("should call script.after() on execute error", async () => {
      const spy = jest.spyOn(batch["script"], "after");
      when(mockExecutor.execute(anything())).thenThrow(new Error("ERROR"));

      await expect(batch.end()).rejects.toStrictEqual(
        new GolemWorkError(
          "Unable to execute script Error: ERROR",
          WorkErrorCode.ScriptExecutionFailed,
          activity.agreement,
          activity,
          activity.provider,
          new Error("ERROR"),
        ),
      );

      expect(spy).toHaveBeenCalled();
    });

    it("should throw error on result stream error", async () => {
      when(mockExecutor.getResultsObservable(anything())).thenReturn(
        buildExecutorResults(undefined, undefined, new Error("FAILURE")),
      );
      await expect(batch.end()).rejects.toStrictEqual(
        new GolemWorkError(
          "Unable to execute script Error: FAILURE",
          WorkErrorCode.ScriptExecutionFailed,
          activity.agreement,
          activity,
          activity.provider,
          new Error("FAILURE"),
        ),
      );
    });
  });

  describe("endStream()", () => {
    beforeEach(() => {
      batch.run("echo 'Hello World'").run("echo 'Hello World 2'");
    });

    it("should work", async () => {
      when(mockExecutor.getResultsObservable(anything())).thenReturn(
        buildExecutorResults([
          buildExeScriptSuccessResult("Hello World"),
          buildExeScriptSuccessResult("Hello World 2"),
        ]),
      );

      const results: Result[] = [];

      const stream = await batch.endStream();
      const allResults = await lastValueFrom(stream.pipe(toArray()));

      for (const result of allResults) {
        results.push(result);
      }

      expect(results.length).toBe(2);
      expect(results[0].stdout).toBe("Hello World");
      expect(results[1].stdout).toBe("Hello World 2");
    });

    it("should initialize script with script.before()", async () => {
      const spy = jest.spyOn(batch["script"], "before");

      await batch.endStream();

      expect(spy).toHaveBeenCalled();
    });

    it("should call script.after() on success", async () => {
      const spy = jest.spyOn(batch["script"], "after");

      const result$ = await batch.endStream();
      // lastValueFrom errors if the stream is empty, so we need to provide a default value
      await lastValueFrom(result$, { defaultValue: undefined });

      expect(spy).toHaveBeenCalled();
    });

    it("should call script.after() on result stream error", async () => {
      const spy = jest.spyOn(batch["script"], "after");
      when(mockExecutor.getResultsObservable(anything())).thenReturn(
        buildExecutorResults(undefined, [buildExeScriptErrorResult("FAILURE", "FAILURE")]),
      );

      const stream = await batch.endStream();
      try {
        await lastValueFrom(stream);
        fail("Expected to throw");
      } catch (e) {
        /* empty */
      }

      expect(spy).toHaveBeenCalled();
    });

    it("should call script.after() on execute error", async () => {
      const spy = jest.spyOn(batch["script"], "after");
      when(mockExecutor.execute(anything())).thenThrow(new Error("ERROR"));

      await expect(batch.endStream()).rejects.toMatchError(
        new GolemWorkError(
          "Unable to execute script Error: ERROR",
          WorkErrorCode.ScriptExecutionFailed,
          activity.agreement,
          activity,
          activity.provider,
          new Error("ERROR"),
        ),
      );

      expect(spy).toHaveBeenCalled();
    });
  });
});

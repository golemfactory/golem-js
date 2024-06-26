import { Activity } from "./activity";
import { _, anything, imock, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { Capture, Deploy, DownloadFile, Run, Script, Start, Terminate, UploadFile } from "./script";
import { buildExeScriptSuccessResult } from "../../tests/utils/helpers";
import { GolemWorkError, WorkErrorCode } from "./exe-unit";
import { Logger, sleep } from "../shared/utils";
import { GolemAbortError } from "../shared/error/golem-error";
import { ExeScriptExecutor } from "./exe-script-executor";
import { StorageProvider } from "../shared/storage";
import { from, lastValueFrom, of, throwError, toArray } from "rxjs";
import { Result, StreamingBatchEvent } from "./results";
import resetAllMocks = jest.resetAllMocks;
import { ActivityModule } from "./activity.module";

describe("ExeScriptExecutor", () => {
  const mockActivity = mock(Activity);
  const mockLogger = imock<Logger>();
  const mockActivityModule = imock<ActivityModule>();
  const mockStorageProvider = imock<StorageProvider>();

  beforeEach(() => {
    reset(mockActivity);
    reset(mockLogger);
    reset(mockStorageProvider);
    reset(mockActivityModule);
    resetAllMocks();
    when(mockActivity.provider).thenReturn({
      id: "test-provider-id",
      name: "test-provider-name",
      walletAddress: "0xProviderWallet",
    });
  });

  describe("Executing", () => {
    it("should execute commands on activity", async () => {
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
      );

      when(mockActivityModule.getBatchResults(anything(), anything(), anything(), anything())).thenResolve([
        new Result({
          isBatchFinished: true,
          result: "Ok",
          stdout: "Done",
          stderr: "",
          index: 1,
          eventDate: new Date().toISOString(),
        }),
      ]);

      const executionMetadata = await executor.execute(new Deploy().toExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata);
      const result = await lastValueFrom(result$);
      expect(result.result).toEqual("Ok");
    });

    it("should execute script and get results by iterator", async () => {
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
      );
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const command4 = new Run("test_command2");
      const command5 = new Terminate();
      const script = Script.create([command1, command2, command3, command4, command5]);

      when(mockActivityModule.getBatchResults(anything(), anything(), anything(), anything())).thenResolve([
        buildExeScriptSuccessResult("test"),
        buildExeScriptSuccessResult("test"),
        buildExeScriptSuccessResult("stdout_test_command_run_1"),
        buildExeScriptSuccessResult("stdout_test_command_run_2"),
        buildExeScriptSuccessResult("test"),
      ]);

      const expectedRunStdOuts = ["test", "test", "stdout_test_command_run_1", "stdout_test_command_run_2", "test"];
      await script.before();
      const executionMetadata = await executor.execute(script.getExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata);
      const results = await lastValueFrom(result$.pipe(toArray()));
      for (const result of results) {
        expect(result.result).toEqual("Ok");
        expect(result.stdout).toEqual(expectedRunStdOuts.shift());
      }

      await script.after([]);
    });

    it("should execute script and get results by events", async () => {
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
      );
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new UploadFile(instance(mockStorageProvider), "testSrc", "testDst");
      const command4 = new Run("test_command1");
      const command5 = new DownloadFile(instance(mockStorageProvider), "testSrc", "testDst");
      const command6 = new Terminate();
      const script = Script.create([command1, command2, command3, command4, command5, command6]);

      when(mockActivityModule.getBatchResults(_, _, _, _)).thenResolve([
        buildExeScriptSuccessResult("test"),
        buildExeScriptSuccessResult("test"),
        buildExeScriptSuccessResult("stdout_test_command_run_1"),
        buildExeScriptSuccessResult("stdout_test_command_run_2"),
        buildExeScriptSuccessResult("test"),
        buildExeScriptSuccessResult("test"),
      ]);

      const expectedRunStdOuts = [
        "test",
        "test",
        "stdout_test_command_run_1",
        "stdout_test_command_run_2",
        "test",
        "test",
      ];
      await script.before();
      const executionMetadata = await executor.execute(script.getExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata);
      let resultCount = 0;
      // each result 2 assertions and 1 in "complete"
      expect.assertions(12 + 1);
      return new Promise<void>((res, rej) => {
        result$.subscribe({
          next: (result) => {
            expect(result.result).toEqual("Ok");
            expect(result.stdout).toEqual(expectedRunStdOuts.shift());
            ++resultCount;
          },
          complete: async () => {
            try {
              await script.after([]);
              expect(resultCount).toEqual(6);
              return res();
            } catch (err) {
              rej(err);
            }
          },
          error: (error) => rej(error),
        });
      });
    });

    it("should execute script by streaming batch", async () => {
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
      );
      const command1 = new Deploy();
      const command2 = new Start();
      const capture: Capture = {
        stdout: { stream: { format: "string" } },
        stderr: { stream: { format: "string" } },
      };
      const command3 = new Run("test_command1", null, null, capture);
      const command4 = new Terminate();
      const script = Script.create([command1, command2, command3, command4]);
      const mockedEvents: StreamingBatchEvent[] = [
        {
          batch_id: "04a9b0f49e564db99e6f15ba95c35817",
          index: 0,
          timestamp: "2022-06-23T10:42:38.626573153",
          kind: { stdout: '{"startMode":"blocking","valid":{"Ok":""},"vols":[]}' },
        },
        {
          batch_id: "04a9b0f49e564db99e6f15ba95c35817",
          index: 0,
          timestamp: "2022-06-23T10:42:38.626958777",
          kind: { finished: { return_code: 0, message: null } },
        },
        {
          batch_id: "04a9b0f49e564db99e6f15ba95c35817",
          index: 1,
          timestamp: "2022-06-23T10:42:38.626960850",
          kind: { started: { command: { start: { args: [] } } } },
        },
        {
          batch_id: "04a9b0f49e564db99e6f15ba95c35817",
          index: 1,
          timestamp: "2022-06-23T10:42:39.946031527",
          kind: { finished: { return_code: 0, message: null } },
        },
        {
          batch_id: "04a9b0f49e564db99e6f15ba95c35817",
          index: 2,
          timestamp: "2022-06-23T10:42:39.946034161",
          kind: {
            started: {
              command: {
                run: {
                  entry_point: "/bin/sh",
                  args: ["-c", "echo test"],
                  capture: { stdout: { stream: { format: "str" } }, stderr: { stream: { format: "str" } } },
                },
              },
            },
          },
        },
        {
          batch_id: "04a9b0f49e564db99e6f15ba95c35817",
          index: 2,
          timestamp: "2022-06-23T10:42:39.957927713",
          kind: { stdout: "test" },
        },
        {
          batch_id: "04a9b0f49e564db99e6f15ba95c35817",
          index: 2,
          timestamp: "2022-06-23T10:42:39.958238754",
          kind: { finished: { return_code: 0, message: null } },
        },
        {
          batch_id: "04a9b0f49e564db99e6f15ba95c35817",
          index: 3,
          timestamp: "2022-06-23T10:42:39.962014674",
          kind: { started: { command: { terminate: {} } } },
        },
        {
          batch_id: "04a9b0f49e564db99e6f15ba95c35817",
          index: 3,
          timestamp: "2022-06-23T10:42:40.009603540",
          kind: { finished: { return_code: 0, message: null } },
        },
      ];
      when(mockActivityModule.observeStreamingBatchEvents(_, _)).thenReturn(from<StreamingBatchEvent[]>(mockedEvents));
      await script.before();
      const executionMetadata = await executor.execute(script.getExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata, true);
      let expectedStdout;
      const results = await lastValueFrom(result$.pipe(toArray()));
      for (const result of results) {
        expect(result).toHaveProperty("index");
        if (result.index === 2 && result.stdout) expectedStdout = result.stdout;
      }
      expect(expectedStdout).toEqual("test");
      await script.after([]);
    });
  });

  describe("Cancelling", () => {
    it("should cancel executor", async () => {
      const ac = new AbortController();
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
        { signalOrTimeout: ac.signal },
      );
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const command4 = new Run("test_command2");
      const command5 = new Run("test_command3");
      const command6 = new Terminate();
      const script = Script.create([command1, command2, command3, command4, command5, command6]);
      await script.before();
      const executionMetadata = await executor.execute(script.getExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata, undefined, undefined);
      ac.abort();

      expect.assertions(1);
      return new Promise<void>((res, rej) => {
        result$.subscribe({
          complete: () => rej("Shouldn't have completed"),
          error: (error) => {
            try {
              expect(error).toEqual(new GolemAbortError(`Execution of script has been aborted`));
              return res();
            } catch (err) {
              rej(err);
            }
          },
        });
      });
    });

    it("should cancel executor while streaming batch", async () => {
      when(mockActivityModule.observeStreamingBatchEvents(_, _)).thenReturn(of());
      const ac = new AbortController();
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
        {
          signalOrTimeout: ac.signal,
        },
      );
      const command1 = new Deploy();
      const command2 = new Start();
      const capture: Capture = {
        stdout: { stream: { format: "string" } },
        stderr: { stream: { format: "string" } },
      };
      const command3 = new Run("test_command1", null, null, capture);
      const command4 = new Terminate();
      const script = Script.create([command1, command2, command3, command4]);
      await script.before();
      const executionMetadata = await executor.execute(script.getExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata, true, undefined);
      ac.abort();

      expect.assertions(1);
      return new Promise<void>((res, rej) => {
        result$.subscribe({
          complete: () => rej("Shouldn't have completed"),
          error: (error) => {
            try {
              expect(error).toEqual(new GolemAbortError(`Execution of script has been aborted`));
              return res();
            } catch (err) {
              rej(err);
            }
          },
        });
      });
    });
  });

  describe("Error handling", () => {
    it("should handle some error", async () => {
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
      );
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const script = Script.create([command1, command2, command3]);

      const error = new Error("Some undefined error");
      when(mockActivityModule.getBatchResults(anything(), anything(), anything(), anything())).thenReject(error);

      const executionMetadata = await executor.execute(script.getExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata, false, 200, 0);

      expect.assertions(7);
      return new Promise<void>((res, rej) => {
        result$.subscribe({
          complete: () => rej("Shouldn't have completed"),
          error: (error) => {
            try {
              expect(error).toBeInstanceOf(GolemWorkError);
              expect(error.code).toEqual(WorkErrorCode.ActivityResultsFetchingFailed);
              expect(error.getActivity()).toBeDefined();
              expect(error.getAgreement()).toBeDefined();
              expect(error.getProvider()?.name).toEqual("test-provider-name");
              expect(error.previous?.toString()).toEqual("Error: Some undefined error");
              expect(error.toString()).toEqual("Error: Unable to get activity results. Error: Some undefined error");
              return res();
            } catch (err) {
              rej(err);
            }
          },
        });
      });
    });

    it("should handle non-retryable error", async () => {
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
        {
          activityExeBatchResultPollIntervalSeconds: 10,
        },
      );
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const script = Script.create([command1, command2, command3]);

      const error = {
        message: "non-retryable error",
        status: 401,
        toString: () => `Error: non-retryable error`,
      };
      when(mockActivityModule.getBatchResults(anything(), anything(), anything(), anything())).thenReject(error);

      const executionMetadata = await executor.execute(script.getExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata, false, 1_000, 3);

      expect.assertions(6);
      return new Promise<void>((res, rej) => {
        result$.subscribe({
          complete: () => rej("Shouldn't have completed"),
          error: (error) => {
            try {
              expect(error).toBeInstanceOf(GolemWorkError);
              expect(error.code).toEqual(WorkErrorCode.ActivityResultsFetchingFailed);
              expect(error.getActivity()).toBeDefined();
              expect(error.getAgreement()).toBeDefined();
              expect(error.getProvider()?.name).toEqual("test-provider-name");
              expect(error.previous?.toString()).toEqual("Error: non-retryable error");
              return res();
            } catch (err) {
              rej(err);
            }
          },
        });
      });
    });

    it("should retry when a retryable error occurs", async () => {
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
      );
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const script = Script.create([command1, command2, command3]);

      const error = {
        message: "timeout",
        status: 408,
        toString: () => `Error: timeout`,
      };
      const testResult = new Result({
        isBatchFinished: true,
        result: "Ok" as "Ok" | "Error",
        stdout: "Done",
        stderr: "",
        index: 1,
        eventDate: new Date().toISOString(),
      });
      when(mockActivityModule.getBatchResults(anything(), anything(), anything(), anything()))
        .thenReject(error)
        .thenReject(error)
        .thenResolve([testResult]);

      const executionMetadata = await executor.execute(script.getExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata, false, undefined, 10);
      const results = await lastValueFrom(result$.pipe(toArray()));
      for (const result of results) {
        expect(result).toEqual(testResult);
      }
      verify(mockActivityModule.getBatchResults(anything(), anything(), anything(), anything())).times(3);
    }, 7_000);

    it("should handle termination error", async () => {
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
      );
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const script = Script.create([command1, command2, command3]);
      const error = {
        message: "GSB error: endpoint address not found. Terminated.",
        status: 500,
        toString: () => "GSB error: endpoint address not found. Terminated.",
      };

      when(mockActivityModule.getBatchResults(anything(), anything(), anything(), anything())).thenReject(error);
      const executionMetadata = await executor.execute(script.getExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata, false, undefined, 1);

      expect.assertions(7);
      return new Promise<void>((res, rej) => {
        result$.subscribe({
          complete: () => rej("Shouldn't have completed"),
          error: (error) => {
            try {
              expect(error).toBeInstanceOf(GolemWorkError);
              expect(error.code).toEqual(WorkErrorCode.ActivityResultsFetchingFailed);
              expect(error.getActivity()).toBeDefined();
              expect(error.getAgreement()).toBeDefined();
              expect(error.getProvider()?.name).toEqual("test-provider-name");
              expect(error.previous?.message).toEqual("GSB error: endpoint address not found. Terminated.");
              expect(error.toString()).toEqual(
                "Error: Unable to get activity results. GSB error: endpoint address not found. Terminated.",
              );
              return res();
            } catch (err) {
              rej(err);
            }
          },
        });
      });
    });

    it("should handle timeout error", async () => {
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
      );
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const command4 = new Run("test_command2");
      const command5 = new Run("test_command3");
      const script = Script.create([command1, command2, command3, command4, command5]);
      const executionMetadata = await executor.execute(script.getExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata, false, 1);

      // wait for execute timeout to fire
      await sleep(10, true);

      expect.assertions(2);
      return new Promise<void>((res, rej) => {
        result$.subscribe({
          complete: () => rej("Shouldn't have completed"),
          error: (error) => {
            try {
              expect(error).toBeInstanceOf(GolemAbortError);
              expect(error.toString()).toEqual("Error: Execution of script has been aborted");
              return res();
            } catch (err) {
              rej(err);
            }
          },
        });
      });
    });

    it("should handle abort error while streaming batch", async () => {
      when(mockActivityModule.observeStreamingBatchEvents(anything(), anything())).thenReturn(of());
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
        {
          signalOrTimeout: 1,
        },
      );
      const command1 = new Deploy();
      const command2 = new Start();
      const capture: Capture = {
        stdout: { stream: { format: "string" } },
        stderr: { stream: { format: "string" } },
      };
      const command3 = new Run("test_command1", null, null, capture);
      const command4 = new Terminate();
      const script = Script.create([command1, command2, command3, command4]);
      await script.before();
      const executionMetadata = await executor.execute(script.getExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata, true, 800);

      // wait for ExeScriptExecutor abort signal to fire
      await sleep(10, true);

      expect.assertions(2);
      return new Promise<void>((res, rej) => {
        result$.subscribe({
          complete: () => rej("Shouldn't have completed"),
          error: (error) => {
            try {
              expect(error).toBeInstanceOf(GolemAbortError);
              expect(error.toString()).toEqual("Error: Execution of script has been aborted");
              return res();
            } catch (err) {
              rej(err);
            }
          },
        });
      });
    });

    it("should handle some error while streaming batch", async () => {
      const executor = new ExeScriptExecutor(
        instance(mockActivity),
        instance(mockActivityModule),
        instance(mockLogger),
      );
      const command1 = new Deploy();
      const command2 = new Start();
      const capture: Capture = {
        stdout: { stream: { format: "string" } },
        stderr: { stream: { format: "string" } },
      };
      const command3 = new Run("test_command1", null, null, capture);
      const command4 = new Terminate();
      const script = Script.create([command1, command2, command3, command4]);
      const mockedEventSourceErrorMessage = "Some undefined error";
      when(mockActivityModule.observeStreamingBatchEvents(_, _)).thenReturn(
        throwError(() => mockedEventSourceErrorMessage),
      );
      await script.before();
      const executionMetadata = await executor.execute(script.getExeScriptRequest());
      const result$ = executor.getResultsObservable(executionMetadata, true);

      expect.assertions(7);
      return new Promise<void>((res, rej) => {
        result$.subscribe({
          complete: () => rej("Shouldn't have completed"),
          error: (error) => {
            try {
              expect(error).toBeInstanceOf(GolemWorkError);
              expect(error.code).toEqual(WorkErrorCode.ActivityResultsFetchingFailed);
              expect(error.getActivity()).toBeDefined();
              expect(error.getAgreement()).toBeDefined();
              expect(error.getProvider()?.name).toEqual("test-provider-name");
              expect(error.previous?.toString()).toEqual("Some undefined error");
              expect(error.toString()).toEqual("Error: Unable to get activity results. Some undefined error");
              return res();
            } catch (err) {
              rej(err);
            }
          },
        });
      });
    });
  });
});
